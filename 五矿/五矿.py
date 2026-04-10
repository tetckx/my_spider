import requests
import json
import execjs

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

with open('五矿.js', 'r', encoding='utf-8') as f:
    js_code = f.read()
ctx = execjs.compile(js_code)
for page in range(1, 3):
    publicKey = requests.post('https://ec.minmetals.com.cn/open/homepage/public', headers=headers, cookies=cookies).text
    param = ctx.call('get_param', publicKey, page)
    data = {
        "param": param
    }
    data = json.dumps(data, separators=(',', ':'))
    response = requests.post(url, headers=headers, cookies=cookies, data=data)

    print(response.json())
    print(response)
