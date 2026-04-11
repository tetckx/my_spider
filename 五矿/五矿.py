import requests
import json
import execjs
import csv
import os
from datetime import datetime

headers = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Content-Type": "application/json",
    "Origin": "https://ec.minmetals.com.cn",
    "Pragma": "no-cache",
    "Referer": "https://ec.minmetals.com.cn/open/home/platform-info",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
    "sec-ch-ua": "\"Not(A:Brand\";v=\"8\", \"Chromium\";v=\"144\", \"Google Chrome\";v=\"144\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\""
}
cookies = {
    "SUNWAY-ESCM-COOKIE": "ab069e0b-161f-4929-8f5b-f1231163f013",
    "__jsluid_s": "f735e940f9e6d7e95882369a14c5cef7",
    "JSESSIONID": "8FCFACE3D4A1C4C195D6E6EC011379ED"
}
url = "https://ec.minmetals.com.cn/open/homepage/zbs/by-lx-page"

# 生成带时间戳的文件名，例如 wukuang_20260411_143025.csv
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
CSV_FILENAME = f"wukuang_{timestamp}.csv"
FIELD_NAMES = ["title", "publish_time", "bid_type", "detail_url", "page_index", "crawl_time"]


def save_to_csv(data, page, is_first_page):
    """将单页数据保存到 CSV，如果是第一页则写入表头"""
    records = data.get("list", []) if isinstance(data, dict) else []

    if not records:
        print(f"第 {page} 页没有数据")
        return

    # 使用 'a' 模式追加写入，但第一页时文件可能不存在，会自动创建
    # 注意：由于每次运行文件名不同，不会覆盖旧文件
    with open(CSV_FILENAME, mode='a', newline='', encoding='utf-8-sig') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=FIELD_NAMES)
        # 如果是第一页且文件为空（刚创建），写入表头
        if is_first_page and os.path.getsize(CSV_FILENAME) == 0:
            writer.writeheader()

        for item in records:
            bm = item.get("bm", "")
            detail_url = f"https://ec.minmetals.com.cn/open/homepage/zbs/detail?bm={bm}" if bm else ""

            row = {
                "title": item.get("mc", ""),
                "publish_time": item.get("rq", ""),
                "bid_type": item.get("lxmc", ""),
                "detail_url": detail_url,
                "page_index": page,
                "crawl_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            writer.writerow(row)

    print(f"第 {page} 页已保存 {len(records)} 条数据到 {CSV_FILENAME}")


# 加载加密 JS
with open('五矿.js', 'r', encoding='utf-8') as f:
    js_code = f.read()
ctx = execjs.compile(js_code)

# 循环采集多页
for page in range(1, 3):
    print(f"\n===== 开始采集第 {page} 页 =====")
    publicKey = requests.post('https://ec.minmetals.com.cn/open/homepage/public', headers=headers, cookies=cookies).text
    param = ctx.call('get_param', publicKey, page)
    data = {"param": param}
    data_json = json.dumps(data, separators=(',', ':'))
    response = requests.post(url, headers=headers, cookies=cookies, data=data_json)

    resp_json = response.json()
    print(f"响应状态码：{response.status_code}")

    # 判断是否为第一页（用于写入表头）
    is_first = (page == 1)
    save_to_csv(resp_json, page, is_first)

print(f"\n采集完成！数据已保存到 {CSV_FILENAME}")