# 爬虫工程师作品集

[![Python](https://img.shields.io/badge/Python-3.9-blue.svg)](https://www.python.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.58-green.svg)](https://playwright.dev/)
[![Scrapy](https://img.shields.io/badge/Scrapy-2.11-orange.svg)](https://scrapy.org/)

## 👤 关于我

一名专注于数据采集与反爬对抗的 Python 爬虫工程师，2 年实战经验。擅长处理动态渲染、加密参数逆向、浏览器指纹隐藏等高难度反爬场景，独立完成过多个商业级数据采集项目。

**核心技能**：
- **语言**：Python、JavaScript（基础逆向）
- **框架**：Scrapy、Playwright、Selenium、Requests
- **解析**：XPath、CSS、正则表达式、BeautifulSoup
- **存储**：MySQL、MongoDB、CSV/JSON
- **反爬**：指纹隐藏、IP 代理池、验证码识别、行为模拟
- **工具**：Git、Charles、Postman

---

## 📂 项目列表

本仓库包含我的若干非商业爬虫项目，难度由浅入深，展示了从普通网页采集到高反爬商业平台攻克的完整能力进阶。

| 序号 | 项目名称 | 技术难度 | 核心亮点 | 技术栈 |
|:---:|:---|:---:|---|:---|
| 01 | **ITF 能源项目数据采集** | ⭐⭐ | 动态渲染 + 翻页遍历，香港政府公开数据 | Playwright、BeautifulSoup、CSV |
| 02 | **票星球演唱会信息抓取** | ⭐⭐⭐ | 反检测 + 代理池 + 增量采集，演出票务平台 | Playwright、Stealth.js、Pandas、MySQL |
| 03 | **京东联盟秒杀数据采集** | ⭐⭐⭐ | 突破京东高难度反爬，成功率 98.9%，零 IP 封禁 | Playwright、CDP 接管、MongoDB、代理集群 |

---

## 🔥 项目详情

### 01. ITF 能源项目数据采集
**目标网站**：香港创新科技署项目搜索平台  
**任务描述**：抓取 Technology Area 为 Energy 的政府资助项目数据
**核心成果**：
- 使用 Playwright 模拟浏览器，解决页面 JavaScript 动态渲染问题
- 实现自动翻页遍历，结构化提取项目编号、名称、资助金额等字段
- 输出 JSON 和 CSV 两种格式，数据准确率 100%

[📁 查看项目代码](./ITF)

---

### 02. 票星球演唱会信息抓取
**目标网站**：票星球（piaoxingqiu.com）  
**任务描述**：实时采集全国热门演唱会的名称、艺人、时间、场馆、票价、库存状态及座位图  
**核心成果**：
- 采用 Playwright + Stealth.js 隐藏 WebDriver 特征，绕过浏览器指纹检测
- 搭建 IP 代理池，实现请求失败自动切换，采集成功率稳定在 95% 以上
- 设计增量采集架构，基于 Redis 记录已抓取演出 ID，避免重复请求
- 数据清洗后存入 MySQL，支持后续价格波动趋势分析

[📁 查看项目代码](./票星球)

---

### 03. 京东联盟秒杀数据采集
**目标网站**：京东联盟（union.jd.com）  
**任务描述**：突破京东高难度反爬，稳定采集高佣秒杀商品的标题、价格、佣金、销量、优惠券、推广链接  
**核心成果**：
- 攻克京东多层反爬体系：动态参数加密、Canvas/WebGL 指纹采集、鼠标轨迹监测
- 通过 CDP 远程调试接管已登录 Chrome 实例，继承真实用户登录态，大幅降低风控
- 搭建高可用 IP 代理集群，成功率从 20% 提升至 98.9%，实现零 IP 封禁
- 采用双轨采集架构：优先调用官方 API（合规），API 异常时自动切换网页爬虫兜底
- 数据存入 MongoDB，支持灵活字段扩展，每日定时增量更新

[📁 查看项目代码](./京东联盟秒杀)

---

## 🚀 如何使用

### 1. 克隆仓库
```bash
git clone https://github.com/tetckx/spiders.git
cd spiders
