const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 配置参数 - 默认用中文关键词"能源"
const CONFIG = {
  language: process.argv[2] || process.env.LANGUAGE || 'zh',
  keywords: process.argv[3] || process.env.KEYWORDS || '能源',
  startPage: parseInt(process.argv[4] || process.env.START_PAGE || '1'),
  endPage: parseInt(process.argv[5] || process.env.END_PAGE || '50')
};

const OUTPUT_DIR = path.join(__dirname, '..');
const KEYWORDslug = CONFIG.keywords.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').toLowerCase();
const CSV_FILE = path.join(OUTPUT_DIR, `itf-${KEYWORDslug}-projects.csv`);
const JSON_FILE = path.join(OUTPUT_DIR, `itf-${KEYWORDslug}-projects.json`);
const XLSX_FILE = path.join(OUTPUT_DIR, `itf-${KEYWORDslug}-projects.xlsx`);

async function scrape() {
  console.log('========================================');
  console.log('  ITF 项目数据爬虫');
  console.log('========================================');
  console.log('');
  console.log('配置:');
  console.log(`  语言: ${CONFIG.language}`);
  console.log(`  关键词: ${CONFIG.keywords}`);
  console.log(`  页数: ${CONFIG.startPage} - ${CONFIG.endPage}`);
  console.log('');

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage({ 
    viewport: { width: 1920, height: 1080 }
  });
  
  // 使用正确的搜索页面URL - 根据搜索结果,正确的页面是 index.htm
  const searchPage = CONFIG.language === 'zh' 
    ? 'https://www.itf.gov.hk/tc/project-search/index.htm'
    : 'https://www.itf.gov.hk/en/project-search/index.htm';
  
  console.log(`打开搜索页面: ${searchPage}`);
  await page.goto(searchPage, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  
  // 找到搜索框并输入关键词
  console.log(`输入关键词: ${CONFIG.keywords}`);
  
  // 尝试多种可能的搜索框选择器
  const searchInput = await page.$('input[name="Keywords"]') || 
                     await page.$('input[id="Keywords"]') ||
                     await page.$('input[type="search"]') ||
                     await page.$('input:text');
  
  if (searchInput) {
    await searchInput.fill(CONFIG.keywords);
    await page.waitForTimeout(500);
    
    // 点击搜索按钮或按回车
    try {
      await page.keyboard.press('Enter');
    } catch(e) {}
    
    // 等待搜索结果
    console.log('等待搜索结果...');
    await page.waitForTimeout(5000);
    
    console.log(`当前URL: ${page.url()}`);
  }
  
  let allData = [];
  
  // 分页获取数据
  for (let pageNum = CONFIG.startPage; pageNum <= CONFIG.endPage; pageNum++) {
    // 如果不是第一页,需要翻页
    if (pageNum > 1) {
      // 构建带页码的URL
      const baseUrl = page.url().split('?')[0];
      const pageUrl = `${baseUrl}?Keywords=${encodeURIComponent(CONFIG.keywords)}&Page=${pageNum}`;
      console.log(`翻到第 ${pageNum} 页...`);
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
    }
    
    console.log(`正在获取第 ${pageNum}/${CONFIG.endPage} 页...`);
    await page.waitForTimeout(2000);
    
    // 尝试找表格
    const table = await page.$('table.colorTbl') || 
                 await page.$('table.table') ||
                 await page.$('table');
    
    if (!table) {
      console.log(`  第 ${pageNum} 页: 未找到表格`);
      continue;
    }
    
    const rows = await table.$$('tr');
    let pageCount = 0;
    
    for (let i = 1; i < rows.length; i++) {
      const link = await rows[i].$('a.rowlink') ||
                   await rows[i].$('a[href*="project"]');
      
      if (link) {
        const cells = await rows[i].$$('td');
        
        if (cells.length >= 3) {
          const text1 = await cells[0]?.textContent();
          const text2 = await cells[1]?.textContent();
          const text3 = await cells[2]?.textContent();
          const text4 = await cells[3]?.textContent();
          
          if (text1 && text2) {
            allData.push({
              '项目编号': text1.trim(),
              '项目名称': text2.trim(),
              '首席申请机构': text3?.trim() || '-',
              '批准资金': text4?.trim() || '-'
            });
            pageCount++;
          }
        }
      }
    }
    
    console.log(`  第 ${pageNum} 页: ${pageCount} 条 (总计: ${allData.length})`);
    
    if (pageCount === 0 && pageNum > 1) {
      console.log('没有更多数据');
      break;
    }
  }
  
  await browser.close();
  
  if (allData.length === 0) {
    console.log('');
    console.log('未获取到数据!');
    process.exit(1);
  }
  
  console.log('');
  console.log('========== 保存数据 ==========');
  
  // 保存CSV
  console.log('保存CSV...');
  const csvHeader = '项目编号,项目名称,首席申请机构,批准资金';
  const csvRows = allData.map(d => {
    return `${d['项目编号']},"${d['项目名称'].replace(/"/g, '""')}","${d['首席申请机构'].replace(/"/g, '""')}",${d['批准资金']}`;
  });
  fs.writeFileSync(CSV_FILE, [csvHeader, ...csvRows].join('\n'), 'utf8');
  console.log(`  已保存: ${CSV_FILE}`);
  
  // 保存JSON
  console.log('保存JSON...');
  fs.writeFileSync(JSON_FILE, JSON.stringify(allData, null, 2), 'utf8');
  console.log(`  已保存: ${JSON_FILE}`);
  
  // 保存XLSX
  console.log('保存XLSX...');
  const worksheet = XLSX.utils.json_to_sheet(allData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '项目数据');
  worksheet['!cols'] = [{wch: 18}, {wch: 70}, {wch: 50}, {wch: 20}];
  XLSX.writeFile(workbook, XLSX_FILE);
  console.log(`  已保存: ${XLSX_FILE}`);
  
  console.log('');
  console.log('========== 完成 ==========');
}

scrape().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});