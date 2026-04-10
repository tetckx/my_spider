const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSXLib = require('xlsx');

// 读取配置
let CFG = {
  lang: 'sc',
  kw: '能源',
  pages: 50
};

try {
  const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
  CFG = { ...CFG, ...config };
} catch (e) {
  // 使用默认配置
}

// 命令行参数覆盖
if (process.argv[2]) CFG.lang = process.argv[2];
if (process.argv[3]) CFG.kw = process.argv[3];
if (process.argv[4]) CFG.pages = parseInt(process.argv[4]);

const DIR = path.join(__dirname, '..');
const KWS = CFG.kw.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').toLowerCase();
const CSV = path.join(DIR, 'itf-' + KWS + '-projects.csv');
const JSON_FILE = path.join(DIR, 'itf-' + KWS + '-projects.json');
const XLSX_FILE = path.join(DIR, 'itf-' + KWS + '-projects.xlsx');

// 边爬边存
function saveData(data) {
  // CSV
  const hd = '项目编号,项目名称,首席申请机构,批准资金';
  const lines = [hd];
  for (const d of data) {
    const title = d['项目名称'].replace(/"/g, '""');
    const org = d['首席申请机构'].replace(/"/g, '""');
    lines.push(`${d['项目编号']},"${title}","${org}",${d['批准资金']}`);
  }
  fs.writeFileSync(CSV, lines.join('\n'), 'utf8');
  console.log(`  已保存CSV: ${data.length}条`);
  
  // JSON
  fs.writeFileSync(JSON_FILE, JSON.stringify(data, null, 2), 'utf8');
  
  // XLSX
  try {
    const ws = XLSXLib.utils.json_to_sheet(data);
    const wb = XLSXLib.utils.book_new();
    XLSXLib.utils.book_append_sheet(wb, ws, '项目数据');
    XLSXLib.writeFile(wb, XLSX_FILE);
  } catch (e) { console.log('XLSX跳过'); }
}

async function run() {
  console.log('=== ITF 数据爬虫 ===');
  console.log(`语言: ${CFG.lang}, 关键词: ${CFG.kw}`);
  console.log('');

  const br = await chromium.launch({ headless: false });
  const pg = await br.newPage();
  
  const lg = CFG.lang === 'sc' ? 'sc' : (CFG.lang === 'zh' ? 'tc' : 'en');
  const srch = `https://www.itf.gov.hk/${lg}/project-search/search-result/index.html?Keywords=${encodeURIComponent(CFG.kw)}&isAdvSearch=0`;
  
  console.log(`加载: ${srch}`);
  await pg.goto(srch, {waitUntil: 'load', timeout: 60e3});
  await pg.waitForTimeout(2e3);
  
  // 获取总项目数
  let totalItems = 0;
  try {
    const body = await pg.$('body');
    const text = await body.textContent();
    const match = text.match(/(\d+)\s*项.*符合检索条件/);
    if (match) {
      totalItems = parseInt(match[1]);
      console.log(`总项目数: ${totalItems}`);
    }
  } catch (e) { /* ignore */ }
  
  // 计算总页数 (每页10条)
  if (totalItems > 0) {
    CFG.pages = Math.ceil(totalItems / 10);
  }
  
  console.log(`目标页数: ${CFG.pages}`);
  
  // 等待数据加载
  console.log('等待数据加载...');
  try {
    await pg.waitForFunction(() => document.body.innerHTML.includes('class="refno"'), {timeout: 30e3});
  } catch (e) {
    console.log('等待超时，尝试继续...');
  }
  await pg.waitForTimeout(3e3);
  
  console.log(`URL: ${pg.url()}`);
  
  let data = [];
  
  // 提取表格数据
  for (let p = 1; p <= CFG.pages; p++) {
    if (p > 1) {
      await pg.goto(`${srch}&Page=${p}&SortBy=ref`, {waitUntil: 'networkidle', timeout: 30e3});
      await pg.waitForTimeout(2e3);
    }
    console.log(`获取页 ${p}/${CFG.pages}...`);
    
    const tbl = await pg.$('table#searchResultTbl');
    if (!tbl) {
      console.log(`  无表格, 停止`);
      break;
    }
    
    const html = await tbl.innerHTML();
    const trs = html.match(/<tr><td[^>]*>([\s\S]*?)<\/td><\/tr>/g) || [];
    let cnt = 0;
    for (const tr of trs) {
      const ref = tr.match(/<span class="refno">([^<]+)<\/span>/);
      const title = tr.match(/<span class="title">([^<]+)<\/span>/);
      const lead = tr.match(/<span class="lead">([^<]+)<\/span>/);
      const fund = tr.match(/<span class="fund">([^<]+)<\/span>/);
      if (ref && title) {
        data.push({
          '项目编号': ref[1].trim(),
          '项目名称': title[1].trim(),
          '首席申请机构': lead?.[1]?.trim() || '-',
          '批准资金': fund?.[1]?.trim() || '-'
        });
        cnt++;
      }
    }
    console.log(`  ${cnt} 条, 共 ${data.length}`);
    if (cnt === 0) break;
    
    // 边爬边存
    saveData(data);
  }
  
  await br.close();
  
  if (data.length === 0) {
    console.log('无数据!');
    process.exit(1);
  }
  
  console.log('');
  console.log('=== 完成 ===');
  console.log(`总计: ${data.length}条`);
}

run().catch(e => { console.error(e.message); process.exit(1); });