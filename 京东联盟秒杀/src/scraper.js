const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const XLSX = require('xlsx');

/**
 * 京东联盟秒杀专区数据采集工具 v2.3
 * 支持自定义存储路径，自动采集所有秒杀时段，支持JSON/CSV/XLSX导出
 */

const VERSION = '2.3';

class JDSeckillScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.scrapDate = new Date();
        this.currentSeckillDate = new Date(this.scrapDate);
        // 项目根目录（src的上一级）
        this.projectRoot = path.dirname(__dirname);
        this.config = this.loadConfig();
        this.outputDir = this.config.outputPath || this.projectRoot;
    }
    
    loadConfig() {
        const configPath = path.join(this.projectRoot, 'config.json');
        try {
            if (fs.existsSync(configPath)) {
                return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            }
        } catch (e) {}
        return { outputPath: '', pages: 4 };
    }
    
    saveConfig(config) {
        const configPath = path.join(this.projectRoot, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }
    
    prompt(question) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise(resolve => {
            rl.question(question, answer => {
                rl.close();
                resolve(answer);
            });
        });
    }
    
    async configurePath() {
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                    存储路径设置                              ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        
        const currentPath = this.config.outputPath || this.projectRoot;
        console.log(`当前存储路径: ${currentPath}`);
        console.log('(直接回车使用当前路径)\n');
        
        const newPath = await this.prompt('请输入新的存储路径: ');
        
        if (newPath.trim()) {
            if (!fs.existsSync(newPath.trim())) {
                try {
                    fs.mkdirSync(newPath.trim(), { recursive: true });
                    console.log(`已创建目录: ${newPath.trim()}`);
                } catch (e) {
                    console.log(`目录创建失败: ${e.message}`);
                    return false;
                }
            }
            
            this.config.outputPath = newPath.trim();
            this.outputDir = newPath.trim();
            this.saveConfig(this.config);
            console.log(`存储路径已更新: ${newPath.trim()}\n`);
        }
        
        return true;
    }
    
    async getAllSeckillTimes() {
        return await this.page.evaluate(() => {
            const times = [];
            const items = document.querySelectorAll('.seckill-item');
            
            items.forEach(item => {
                const timeEl = item.querySelector('.time');
                const isActive = item.classList.contains('active');
                const isDisabled = item.classList.contains('disabled');
                
                if (timeEl) {
                    times.push({
                        time: timeEl.textContent.trim(),
                        active: isActive,
                        ended: isDisabled
                    });
                }
            });
            
            return times;
        });
    }
    
    async scrapePage() {
        return await this.page.evaluate(() => {
            const cards = document.querySelectorAll('.search-card, .card');
            const results = [];
            
            cards.forEach(card => {
                try {
                    let title = '';
                    const titleEl = card.querySelector('p.two a');
                    if (titleEl) title = titleEl.textContent.trim();
                    
                    let price = '';
                    const priceEl = card.querySelector('p.three span.real-price');
                    if (priceEl) {
                        // 提取价格数字，去掉"到手价"三个字
                        const priceText = priceEl.textContent.trim();
                        const priceMatch = priceText.match(/￥?([\d.]+)/);
                        if (priceMatch) {
                            price = '￥' + priceMatch[1];
                        }
                    }
                    
                    let goodComment = '';
                    const commentEl = card.querySelector('p.three span.four');
                    if (commentEl) goodComment = commentEl.textContent.trim();
                    
                    let shop = '';
                    const shopEl = card.querySelector('div.shop-detail');
                    if (shopEl) shop = shopEl.textContent.trim();
                    
                    if (title || price) {
                        results.push({ 
                            title: title || '未提取到标题', 
                            price: price || '未提取到价格', 
                            shop: shop || '未提取到店铺', 
                            goodComment: goodComment || '暂无好评数' 
                        });
                    }
                } catch (e) {}
            });
            
            return results;
        });
    }
    
    async goToPage(pageNum) {
        return await this.page.evaluate((num) => {
            // 方法1: 点击数字页码按钮
            const pageButtons = document.querySelectorAll('.el-pager li, [class*="pagination"] li');
            for (const btn of pageButtons) {
                if (btn.textContent.trim() === String(num) && btn.offsetParent !== null && !btn.classList.contains('more')) {
                    btn.click();
                    return true;
                }
            }
            
            // 方法2: 点击"下一页"按钮
            const nextButtons = document.querySelectorAll('.btn-next, .btn-next:not(.is-disabled)');
            for (const btn of nextButtons) {
                if (btn.offsetParent !== null && !btn.disabled && !btn.classList.contains('is-disabled')) {
                    btn.click();
                    return true;
                }
            }
            
            // 方法3: 查找包含"下一页"文本的元素
            const allButtons = document.querySelectorAll('button, a');
            for (const btn of allButtons) {
                const text = btn.textContent.trim();
                if (text === '下一页' || text === '下页') {
                    if (btn.offsetParent !== null && !btn.disabled && !btn.classList.contains('is-disabled')) {
                        btn.click();
                        return true;
                    }
                }
            }
            
            // 方法4: 点击有.next类的元素
            const nextClassElements = document.querySelectorAll('.next');
            for (const el of nextClassElements) {
                if (el.offsetParent !== null && !el.disabled && !el.classList.contains('is-disabled')) {
                    el.click();
                    return true;
                }
            }
            
            return false;
        }, pageNum);
    }
    
    async clickSeckillTime(time) {
        return await this.page.evaluate((targetTime) => {
            const items = document.querySelectorAll('.seckill-item');
            for (const item of items) {
                const timeEl = item.querySelector('.time');
                if (timeEl && timeEl.textContent.trim() === targetTime) {
                    item.click();
                    return true;
                }
            }
            return false;
        }, time);
    }
    
    async checkRiskControl() {
        const cards = await this.page.$$('.search-card, .card');
        
        // 检查是否有验证码/风控提示
        const pageText = await this.page.evaluate(() => document.body.innerText);
        if (/验证码.*验证|人机.*验证|请.*登录.*继续|访问过于频繁/.test(pageText)) {
            return { blocked: true, reason: 'captcha' };
        }
        
        // 没有商品卡片但也没有风控提示，说明当前时段无商品
        if (cards.length === 0) {
            return { blocked: true, reason: 'no_data' };
        }
        
        return { blocked: false };
    }
    
    async waitForDataLoad() {
        // 等待数据加载
        await new Promise(resolve => setTimeout(resolve, 2000));
        // 等待卡片出现
        await this.page.waitForSelector('.search-card, .card', { timeout: 10000 }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 快速检测下一页是否有商品（短等待）
    async quickCheckNextPage() {
        // 等待1秒让页面开始加载
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 检测商品数量
        const count = await this.page.evaluate(() => {
            return document.querySelectorAll('.search-card, .card').length;
        });
        
        if (count === 0) {
            // 再等1秒检测一次（处理慢加载）
            await new Promise(resolve => setTimeout(resolve, 1000));
            const count2 = await this.page.evaluate(() => {
                return document.querySelectorAll('.search-card, .card').length;
            });
            return count2 > 0;
        }
        
        return count > 0;
    }
    
    async initBrowser() {
        const chromePath = this.findChromePath();
        
        this.headless = true;
        
        this.browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage']
        });
        
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1920, height: 1080 });
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await this.page.setRequestInterception(true);
        await this.page.on('request', request => {
            const url = request.url();
            if (url.includes('captcha') || url.includes('risk') || url.includes('verify')) {
                request.abort();
            } else {
                request.continue();
            }
        });
    }
    
    // 风控时切换到有头模式
    async switchToHeadedMode() {
        if (!this.headless) return;
        
        console.log('正在切换到有头模式...');
        this.headless = false;
        
        const chromePath = this.findChromePath();
        const currentUrl = this.page ? this.page.url() : 'https://union.jd.com/proManager/index';
        
        // 关闭当前浏览器
        if (this.browser) {
            await this.browser.close();
        }
        
        // 重新启动浏览器（有头模式）
        this.browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1920, height: 1080 });
        await this.page.goto(currentUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    }
    
    findChromePath() {
        const systemPaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/usr/bin/google-chrome'
        ];
        
        for (const p of systemPaths) {
            if (p && fs.existsSync(p)) {
                return p;
            }
        }
        
        const localChrome = path.join(this.projectRoot, 'chrome', 'chrome.exe');
        if (fs.existsSync(localChrome)) {
            return localChrome;
        }
        
        throw new Error('Chrome浏览器未找到');
    }
    
    async handleRiskControl(reason) {
        if (reason === 'no_data') {
            // 当前时段无商品，不是风控
            console.log('当前时段无秒杀商品');
            return false;
        }
        
        console.log('检测到风控限制，请手动解除...');
        
        // 切换到有头模式
        await this.switchToHeadedMode();
        
        console.log('');
        console.log('请在弹出的浏览器窗口中完成验证或解除限制');
        console.log('解除后在此窗口按回车继续...');
        await this.prompt('');
        
        return true;
    }
    
    saveData(products) {
        // 格式: 2026-4-8京东联盟秒杀专区结果
        const d = this.scrapDate;
        const dateFileName = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}京东联盟秒杀专区结果`;
        
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
        
        // JSON
        const jsonPath = path.join(this.outputDir, `${dateFileName}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(products, null, 2), 'utf-8');
        console.log(`JSON已保存: ${jsonPath}`);
        
        // CSV
        const csvPath = path.join(this.outputDir, `${dateFileName}.csv`);
        const csvHeader = '标题,价格,店铺,好评数,秒杀时间\n';
        const csvContent = products.map(p => {
            return `"${p.title}","${p.price}","${p.shop}","${p.goodComment}","${p.seckillTime}"`;
        }).join('\n');
        fs.writeFileSync(csvPath, csvHeader + csvContent, 'utf-8');
        console.log(`CSV已保存: ${csvPath}`);
        
        // XLSX
        const xlsxPath = path.join(this.outputDir, `${dateFileName}.xlsx`);
        
        // 准备Excel数据
        const wsData = [
            ['标题', '价格', '店铺', '好评数', '秒杀时间']
        ];
        products.forEach(p => {
            wsData.push([p.title, p.price, p.shop, p.goodComment, p.seckillTime]);
        });
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // 设置列宽
        ws['!cols'] = [
            { wch: 60 },  // 标题
            { wch: 15 },  // 价格
            { wch: 20 },  // 店铺
            { wch: 15 },  // 好评数
            { wch: 20 }   // 秒杀时间
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, '秒杀商品数据');
        XLSX.writeFile(wb, xlsxPath);
        console.log(`XLSX已保存: ${xlsxPath}`);
        
        return { jsonPath, csvPath, xlsxPath };
    }
    
    async scrapeSingleTimeSlot(timeSlot, maxPages = 50, maxRetries = 3) {
        console.log(`\n正在采集秒杀时段: ${timeSlot.time}`);
        
        const clicked = await this.clickSeckillTime(timeSlot.time);
        if (!clicked) {
            console.log(`无法点击秒杀时段 ${timeSlot.time}`);
            return [];
        }
        
        await this.waitForDataLoad();
        
        // 0:00表示第二天，更新当前处理日期
        if (timeSlot.time === '00:00' || timeSlot.time === '0:00') {
            this.currentSeckillDate.setDate(this.currentSeckillDate.getDate() + 1);
        }
        const dateStr = this.currentSeckillDate.toLocaleDateString('zh-CN');
        const fullSeckillTime = `${dateStr} ${timeSlot.time}`;
        
        const allProducts = [];
        let page = 1;
        let hasMorePages = true;
        
        while (hasMorePages && page <= maxPages) {
            console.log(`  第 ${page} 页...`);
            
            let retries = 0;
            let success = false;
            let prevPageCount = 0;
            
            while (retries < maxRetries && !success) {
                try {
                    const products = await this.scrapePage();
                    console.log(`    获取 ${products.length} 条商品`);
                    
                    products.forEach(p => {
                        p.seckillTime = fullSeckillTime;
                    });
                    
                    allProducts.push(...products);
                    
                    // 判断是否为最后一页：商品数量少于50条
                    if (products.length > 0 && products.length < 50) {
                        console.log(`    已是最后一页（${products.length} 条 < 50 条）`);
                        hasMorePages = false;
                        success = true;
                        break;
                    }
                    
                    // 第一页获取0条商品，重试等待加载
                    if (products.length === 0) {
                        if (retries < maxRetries - 1) {
                            console.log(`    等待数据加载...`);
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            retries++;
                            continue;
                        } else {
                            // 重试次数用完，认为没有数据
                            hasMorePages = false;
                            success = true;
                            break;
                        }
                    }
                    
                    // 第一页时检查风控
                    if (page === 1) {
                        const risk = await this.checkRiskControl();
                        if (risk.blocked) {
                            const handled = await this.handleRiskControl(risk.reason);
                            if (!handled) {
                                hasMorePages = false;
                                success = true;
                                break;
                            }
                            retries++;
                            continue;
                        }
                    }
                    
                    success = true;
                    
                    // 记录上一页商品数量
                    prevPageCount = products.length;
                    
                    // 翻页
                    if (page < maxPages) {
                        const hasNext = await this.goToPage(page + 1);
                        if (hasNext) {
                            // 快速检测下一页是否有商品
                            const nextPageHasData = await this.quickCheckNextPage();
                            if (!nextPageHasData) {
                                hasMorePages = false;
                            }
                        } else {
                            hasMorePages = false;
                        }
                    } else {
                        hasMorePages = false;
                    }
                    
                    page++;
                } catch (e) {
                    console.log(`    采集失败: ${e.message}`);
                    retries++;
                    if (retries < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }
            
            if (!success) {
                hasMorePages = false;
            }
        }
        
        console.log(`  时段 ${timeSlot.time} 采集完成，共 ${allProducts.length} 条`);
        return allProducts;
    }
    
    // 并行采集多个时段
    async scrapeTimeSlotsParallel(timeSlots, maxConcurrency = 3) {
        const results = [];
        
        // 分批并行处理
        for (let i = 0; i < timeSlots.length; i += maxConcurrency) {
            const batch = timeSlots.slice(i, i + maxConcurrency);
            console.log(`\n并行采集第 ${Math.floor(i / maxConcurrency) + 1} 批: ${batch.map(s => s.time).join(', ')}`);
            
            const promises = batch.map(slot => this.scrapeSingleTimeSlot(slot));
            const batchResults = await Promise.all(promises);
            
            batchResults.forEach(products => {
                results.push(...products);
            });
        }
        
        return results;
    }
    
    // 使用多个浏览器并行采集单个时段
    async scrapeTimeSlotWithBrowser(timeSlot) {
        const chromePath = this.findChromePath();
        
        const browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage']
        });
        
        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            await page.goto('https://union.jd.com/proManager/index', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 点击秒杀专区
            await page.evaluate(() => {
                const labels = document.querySelectorAll('label');
                for (const label of labels) {
                    if (label.textContent.includes('秒杀专区')) {
                        label.click();
                        return true;
                    }
                }
                return false;
            });
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // 点击时段
            const clicked = await page.evaluate((targetTime) => {
                const items = document.querySelectorAll('.seckill-item');
                for (const item of items) {
                    const timeEl = item.querySelector('.time');
                    if (timeEl && timeEl.textContent.trim() === targetTime) {
                        item.click();
                        return true;
                    }
                }
                return false;
            }, timeSlot.time);
            
            if (!clicked) {
                await browser.close();
                return [];
            }
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // 计算秒杀时间日期
            let seckillDate = new Date(this.scrapDate);
            if (timeSlot.time === '00:00' || timeSlot.time === '0:00') {
                seckillDate.setDate(seckillDate.getDate() + 1);
            }
            const dateStr = seckillDate.toLocaleDateString('zh-CN');
            const fullSeckillTime = `${dateStr} ${timeSlot.time}`;
            
            const allProducts = [];
            
            // 采集所有页面
            let pageNum = 1;
            let hasMore = true;
            
            while (hasMore && pageNum <= 50) {
                const products = await page.evaluate(() => {
                    const cards = document.querySelectorAll('.search-card, .card');
                    const results = [];
                    cards.forEach(card => {
                        try {
                            let title = '';
                            const titleEl = card.querySelector('p.two a');
                            if (titleEl) title = titleEl.textContent.trim();
                            
                            let price = '';
                            const priceEl = card.querySelector('p.three span.real-price');
                            if (priceEl) {
                                const priceMatch = priceEl.textContent.trim().match(/￥?([\d.]+)/);
                                if (priceMatch) price = '￥' + priceMatch[1];
                            }
                            
                            let goodComment = '';
                            const commentEl = card.querySelector('p.three span.four');
                            if (commentEl) goodComment = commentEl.textContent.trim();
                            
                            let shop = '';
                            const shopEl = card.querySelector('div.shop-detail');
                            if (shopEl) shop = shopEl.textContent.trim();
                            
                            if (title || price) {
                                results.push({ 
                                    title: title || '未提取到标题', 
                                    price: price || '未提取到价格', 
                                    shop: shop || '未提取到店铺', 
                                    goodComment: goodComment || '暂无好评数' 
                                });
                            }
                        } catch (e) {}
                    });
                    return results;
                });
                
                console.log(`  [${timeSlot.time}] 第 ${pageNum} 页: ${products.length} 条`);
                
                products.forEach(p => p.seckillTime = fullSeckillTime);
                allProducts.push(...products);
                
                if (products.length === 0) {
                    hasMore = false;
                } else {
                    // 点击下一页
                    const nextClicked = await page.evaluate(() => {
                        const allButtons = document.querySelectorAll('button, a');
                        for (const btn of allButtons) {
                            const text = btn.textContent.trim();
                            if (text === '下一页' || text === '下页') {
                                if (!btn.disabled && !btn.classList.contains('is-disabled')) {
                                    btn.click();
                                    return true;
                                }
                            }
                        }
                        return false;
                    });
                    
                    if (nextClicked) {
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        pageNum++;
                    } else {
                        hasMore = false;
                    }
                }
            }
            
            await browser.close();
            return allProducts;
            
        } catch (e) {
            await browser.close();
            console.log(`  [${timeSlot.time}] 采集失败: ${e.message}`);
            return [];
        }
    }
    
    // 多浏览器并行采集所有时段
    async scrapeAllTimeSlotsMultiBrowser(timeSlots) {
        const results = [];
        const maxConcurrency = 3;
        
        for (let i = 0; i < timeSlots.length; i += maxConcurrency) {
            const batch = timeSlots.slice(i, i + maxConcurrency);
            console.log(`\n并行采集: ${batch.map(s => s.time).join(', ')}`);
            
            const promises = batch.map(slot => this.scrapeTimeSlotWithBrowser(slot));
            const batchResults = await Promise.all(promises);
            
            batchResults.forEach(products => {
                results.push(...products);
            });
        }
        
        return results;
    }
    
    async scrapeAllTimeSlots() {
        const startTime = Date.now();
        
        try {
            await this.initBrowser();
            
            console.log('正在访问京东联盟秒杀专区...');
            await this.page.goto('https://union.jd.com/proManager/index', { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            console.log('页面标题:', await this.page.title());
            
            let risk = await this.checkRiskControl();
            if (risk.blocked) {
                await this.handleRiskControl(risk.reason);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('正在点击秒杀专区标签...');
            await this.page.evaluate(() => {
                const labels = document.querySelectorAll('label');
                for (const label of labels) {
                    if (label.textContent.includes('秒杀专区')) {
                        label.click();
                        return true;
                    }
                }
                return false;
            });
            
            await this.waitForDataLoad();
            
            const timeSlots = await this.getAllSeckillTimes();
            console.log(`\n发现 ${timeSlots.length} 个秒杀时段:`);
            timeSlots.forEach((ts, i) => {
                const status = ts.ended ? '[已结束]' : (ts.active ? '[正在疯抢]' : '[即将开始]');
                console.log(`  ${i + 1}. ${ts.time} ${status}`);
            });
            
            const activeSlots = timeSlots.filter(ts => !ts.ended);
            console.log(`\n将采集 ${activeSlots.length} 个秒杀时段...\n`);
            
            // 顺序采集
            const allProducts = [];
            for (const slot of activeSlots) {
                const products = await this.scrapeSingleTimeSlot(slot);
                allProducts.push(...products);
            }
            
            await this.browser.close();
            
            const validProducts = allProducts.filter(p => p.title && p.price);
            
            // 计算耗时
            const elapsed = Date.now() - startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
            
            console.log(`\n共采集 ${validProducts.length} 条有效数据`);
            console.log(`总耗时: ${timeStr}`);
            console.log(`存储路径: ${this.outputDir}`);
            
            if (validProducts.length > 0) {
                this.saveData(validProducts);
            }
            
            return validProducts;
            
        } catch (error) {
            console.error('采集过程出错:', error.message);
            if (this.browser) await this.browser.close();
            throw error;
        }
    }
    
    printResults(products) {
        console.log('\n' + '='.repeat(80));
        console.log('前10条商品数据预览:');
        console.log('='.repeat(80));
        
        products.slice(0, 10).forEach((p, i) => {
            console.log(`${i+1}. 标题: ${p.title}`);
            console.log(`   价格: ${p.price}`);
            console.log(`   店铺: ${p.shop}`);
            console.log(`   好评: ${p.goodComment}`);
            console.log(`   秒杀时间: ${p.seckillTime}`);
            console.log('-'.repeat(80));
        });
    }
    
    async showMenu() {
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║          京东联盟秒杀专区数据采集工具 v2.3            ║');
        console.log('║          功能: 自动采集所有秒杀时段数据               ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('  1. 开始采集 (采集所有秒杀时段)');
        console.log('  2. 修改存储路径');
        console.log('  3. 查看当前配置');
        console.log('  4. 退出');
        console.log('');
    }
    
    showConfig() {
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                    当前配置                                ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log(`  存储路径: ${this.config.outputPath || this.projectRoot}`);
        console.log('');
    }
}

async function main() {
    const scraper = new JDSeckillScraper();
    
    // 检查是否为交互式终端
    const isTTY = process.stdin.isTTY;
    
    if (!isTTY) {
        // 非交互模式，直接开始采集
        console.log('自动模式: 开始采集数据...\n');
        try {
            const products = await scraper.scrapeAllTimeSlots();
            if (products.length > 0) {
                scraper.printResults(products);
            }
            console.log('\n采集完成!');
        } catch (error) {
            console.error('\n采集失败:', error.message);
            process.exit(1);
        }
        return;
    }
    
    // 交互式模式，显示菜单
    while (true) {
        await scraper.showMenu();
        const choice = await scraper.prompt('请选择操作 (1-4): ');
        
        // 空选择默认选1
        const trimmedChoice = choice.trim() || '1';
        
        try {
            switch (trimmedChoice) {
                case '1':
                    const products = await scraper.scrapeAllTimeSlots();
                    if (products.length > 0) {
                        scraper.printResults(products);
                    }
                    console.log('\n采集完成!');
                    break;
                case '2':
                    await scraper.configurePath();
                    break;
                case '3':
                    scraper.showConfig();
                    break;
                case '4':
                    console.log('\n感谢使用，再见!');
                    process.exit(0);
                default:
                    console.log('\n无效选择，请输入 1-4');
            }
        } catch (error) {
            console.error('\n操作失败:', error.message);
        }
        
        await scraper.prompt('\n按回车键继续...');
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('程序出错:', error.message);
        process.exit(1);
    });
}

module.exports = JDSeckillScraper;
