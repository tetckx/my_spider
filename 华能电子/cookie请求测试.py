import datetime
import execjs
import json
import requests
from lxml import etree
import csv



def json_to_csv(json_str, csv_filename='announcements.csv'):
    """将公告JSON数据转换为CSV文件"""
    data = json.loads(json_str)
    announcements = data.get('root', [])

    if not announcements:
        print("没有数据可转换")
        return

    # 定义CSV列头（根据第一条记录的键）
    fieldnames = list(announcements[0].keys())

    with open(csv_filename, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for item in announcements:
            # 处理时间戳字段（毫秒级），转换为可读格式
            for time_field in ['createtime', 'edittime', 'activetime', 'beginTime', 'endTime']:
                if time_field in item and item[time_field] is not None:
                    try:
                        # 将毫秒时间戳转换为日期时间字符串
                        dt = datetime.fromtimestamp(item[time_field] / 1000.0)
                        item[time_field] = dt.strftime('%Y-%m-%d %H:%M:%S')
                    except:
                        pass

            # 将None值替换为空字符串，避免写入"None"
            for key, value in item.items():
                if value is None:
                    item[key] = ''

            writer.writerow(item)

    print(f"成功导出 {len(announcements)} 条记录到 {csv_filename}")


url = 'https://ec.chng.com.cn/channel/home/#/'
api_url = 'https://ec.chng.com.cn/scm-uiaoauth-web/s/business/uiaouth/queryAnnouncementByTitle'

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
}

session = requests.session()


def first_request():
    response = session.get(url, headers=headers)
    html = etree.HTML(response.text)

    encrypt_js_code = html.xpath('//script[1]/text()')[0]
    decrypt_js_code_url = 'https://ec.chng.com.cn' + html.xpath('//script[2]/@src')[0]
    decrypt_js_code = session.get(decrypt_js_code_url, headers=headers).text
    return encrypt_js_code, decrypt_js_code


def second_request(encrypt_js_code, decrypt_js_code):
    with open('动态源码生成cookie测试.js', 'r', encoding='utf-8') as f:
        js_code = f.read().replace("'encrypt_js_code'", encrypt_js_code).replace("'decrypt_js_run_code'",
                                                                                 decrypt_js_code)

    ctx = execjs.compile(js_code)
    cookies = ctx.call('get_cookie').split(';')[0].split('=')
    # print('cookies ->', cookies)
    session.cookies.update({cookies[0]: cookies[1]})
    response = session.get(url, headers=headers)
    response.encoding = 'utf-8'
    # print(response.text)
    # print(response.status_code)

    json_data = {
        'start': 0,
        'limit': 100,
        'type': '107',
        'search': '',
        'ifend': '',
    }
    response = session.post(api_url, headers=headers, cookies=session.cookies, json=json_data)
    try:
        json_to_csv(response.text, 'announcements.csv')
        print(response.json())
    except Exception as e:
        print(response.text, e)


encrypt_code, decrypt_code = first_request()
second_request(encrypt_code, decrypt_code)

