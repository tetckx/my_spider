# ITF 项目数据爬虫

从香港创新科技基金 (ITF) 网站爬取项目数据。

## 快速开始

1. 安装依赖: `npm install`
2. 修改 config.json 设置查询参数
3. 运行: `node scrape/scrape.js`

## 配置 (config.json)

| 参数 | 说明 | 可选值 | 默认值 |
|------|------|--------|--------|
| keywords | 搜索关键词 | 任意 | 能源 |
| lang | 语言 | sc/en | sc |
| pages | 页数 | 数字 | 50 |

## 运行

```bash
# 使用config.json配置
node scrape/scrape.js

# 命令行参数覆盖
node scrape/scrape.js sc 电池 30
```

## 输出文件

- `itf-{关键词}-projects.csv`
- `itf-{关键词}-projects.json`
- `itf-{关键词}-projects.xlsx`

## 数据字段

| 字段 | 说明 |
|------|------|
| 项目编号 | 项目唯一编号 |
| 项目名称 | 项目标题 |
| 首席申请机构 | 负责机构 |
| 批准资金 | 资助金额 |