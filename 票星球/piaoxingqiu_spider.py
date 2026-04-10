"""
票星球演出爬虫
- 分类：音乐现场（演唱会、音乐节、Livehouse、音乐会）
- 字段：标题、时间、价格
- 支持分页
- 导出JSON/CSV/XLSX
- 随机UA防风控
"""

import requests
import json
import csv
import time
import sys
import os
import random
from datetime import datetime

# 解决Windows中文编码问题
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "https://m.piaoxingqiu.com"

# 随机UA列表（iOS和Android移动端）
USER_AGENTS = [
    # iOS Safari
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    # Android Chrome
    "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 13; Xiaomi 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 14; OnePlus 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
    # iPad
    "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
]

# 音乐现场相关分类
MUSIC_CATEGORIES = [
    {'code': 17, 'name': '演唱会'},
    {'code': 18, 'name': '音乐节'},
    {'code': 19, 'name': 'Livehouse'},
    {'code': 23, 'name': '音乐会'},
]

def get_random_headers():
    """获取随机Headers"""
    ua = random.choice(USER_AGENTS)
    return {
        "User-Agent": ua,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://m.piaoxingqiu.com/",
    }

class PiaoxingqiuSpider:
    def __init__(self):
        self.session = requests.Session()
        self.results = []
        self.request_count = 0
        self.init_session()
    
    def init_session(self):
        """初始化session"""
        print("[*] 初始化session...")
        # 使用随机UA访问主页获取cookie
        ua = random.choice(USER_AGENTS)
        self.session.get(BASE_URL, headers={"User-Agent": ua})
        print(f"[*] Cookies: {dict(self.session.cookies)}")
    
    def search_shows(self, keyword, page=1):
        """搜索演出"""
        url = f"{BASE_URL}/cyy_gatewayapi/home/pub/v3/show_list/search"
        params = {
            "keyword": keyword,
            "page": page
        }
        
        # 每次请求使用随机UA
        headers = get_random_headers()
        self.request_count += 1
        
        try:
            resp = self.session.get(url, headers=headers, params=params, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if data.get('statusCode') == 200:
                    return data.get('data', {})
        except Exception as e:
            print(f"\n[!] 请求错误: {e}")
        return {}
    
    def parse_shows(self, search_data, category_name):
        """解析演出数据"""
        shows = []
        
        # 处理tours数据
        for tour in search_data.get('tours', []):
            tour_name = tour.get('tourName', '')
            poster = tour.get('tourPosterUrl', '')
            
            # 解析每个演出场次
            for show in tour.get('shows', []):
                shows.append({
                    '标题': tour_name,
                    '场次名称': show.get('showName', ''),
                    '城市': show.get('cityName', ''),
                    '时间': show.get('showDate', ''),
                    '状态': show.get('showStatusTag', ''),
                    '最低价格': self._get_price_from_search(show),
                    '分类': category_name,
                    '海报': poster,
                    '演出ID': show.get('showId', ''),
                })
        
        # 处理searchData数据
        for show in search_data.get('searchData', []):
            shows.append({
                '标题': show.get('showName', ''),
                '场次名称': show.get('showName', ''),
                '城市': show.get('cityName', ''),
                '时间': show.get('showDate', ''),
                '状态': show.get('showStatus', ''),
                '最低价格': self._get_price_from_search(show),
                '分类': category_name,
                '海报': show.get('posterUrl', ''),
                '演出ID': show.get('showId', ''),
            })
        
        return shows
    
    def _get_price_from_search(self, show):
        """从搜索结果获取价格"""
        price_info = show.get('minOriginalPriceVO', {})
        if price_info:
            prefix = price_info.get('prefix', '')
            yuan = price_info.get('yuanNum', '')
            suffix = price_info.get('suffix', '')
            return f"{prefix}{yuan}{suffix}"
        return ""
    
    def crawl(self, keywords=None, max_pages=3):
        """爬取数据"""
        if keywords is None:
            keywords = [cat['name'] for cat in MUSIC_CATEGORIES]
        
        print(f"\n[*] 开始爬取音乐现场相关演出...")
        print(f"[*] 关键词: {keywords}")
        print(f"[*] 最大页数: {max_pages}")
        
        for keyword in keywords:
            print(f"\n[*] 搜索关键词: {keyword}")
            
            for page in range(1, max_pages + 1):
                print(f"    第 {page} 页...", end=" ", flush=True)
                
                data = self.search_shows(keyword, page)
                
                if not data:
                    print("无数据")
                    break
                
                shows = self.parse_shows(data, keyword)
                
                if not shows:
                    print("无演出数据")
                    break
                
                self.results.extend(shows)
                print(f"获取 {len(shows)} 条")
                
                # 检查是否最后一页
                if data.get('isLastPage', True):
                    break
                
                # 随机延迟0.3-1秒
                delay = random.uniform(0.3, 1.0)
                time.sleep(delay)
        
        print(f"\n[*] 总共获取 {len(self.results)} 条数据")
        print(f"[*] 总请求次数: {self.request_count}")
        return self.results
    
    def save_json(self, filepath):
        """保存为JSON"""
        unique_results = self._deduplicate()
        
        print(f"[*] 去重后 {len(unique_results)} 条数据")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(unique_results, f, ensure_ascii=False, indent=2)
        print(f"[+] 已保存JSON: {filepath}")
    
    def save_csv(self, filepath):
        """保存为CSV"""
        if not self.results:
            print("[!] 无数据可保存")
            return
        
        unique_results = self._deduplicate()
        print(f"[*] 去重后 {len(unique_results)} 条数据")
        
        fieldnames = ['标题', '场次名称', '城市', '时间', '状态', '最低价格', '分类', '演出ID']
        
        # 清理数据
        clean_results = []
        for item in unique_results:
            clean_item = {k: (v.replace('\n', ' ').replace('\r', ' ') if isinstance(v, str) else v) 
                         for k, v in item.items()}
            clean_results.append(clean_item)
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(clean_results)
        
        print(f"[+] 已保存CSV: {filepath}")
    
    def save_xlsx(self, filepath):
        """保存为XLSX"""
        try:
            import openpyxl
        except ImportError:
            print("[!] 需要安装openpyxl库: pip install openpyxl")
            return
        
        unique_results = self._deduplicate()
        print(f"[*] 去重后 {len(unique_results)} 条数据")
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "音乐现场演出"
        
        headers = ['标题', '场次名称', '城市', '时间', '状态', '最低价格', '分类', '演出ID']
        ws.append(headers)
        
        for item in unique_results:
            ws.append([
                item.get('标题', ''),
                item.get('场次名称', ''),
                item.get('城市', ''),
                item.get('时间', ''),
                item.get('状态', ''),
                item.get('最低价格', ''),
                item.get('分类', ''),
                item.get('演出ID', ''),
            ])
        
        wb.save(filepath)
        print(f"[+] 已保存XLSX: {filepath}")
    
    def _deduplicate(self):
        """去重"""
        seen_ids = set()
        unique_results = []
        for item in self.results:
            show_id = item.get('演出ID', '')
            if show_id and show_id not in seen_ids:
                seen_ids.add(show_id)
                unique_results.append(item)
        return unique_results


def main():
    print("=" * 60)
    print("票星球演出爬虫 - 音乐现场分类")
    print("=" * 60)
    
    spider = PiaoxingqiuSpider()
    
    # 爬取数据
    keywords = ['演唱会', '音乐节', 'Livehouse', '音乐会']
    spider.crawl(keywords=keywords, max_pages=3)
    
    # 保存路径
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, 'results')
    os.makedirs(output_dir, exist_ok=True)
    
    # 生成文件名
    today = datetime.now().strftime('%Y-%m-%d')
    
    # 保存文件
    spider.save_json(os.path.join(output_dir, f"{today}票星球音乐现场演出.json"))
    spider.save_csv(os.path.join(output_dir, f"{today}票星球音乐现场演出.csv"))
    spider.save_xlsx(os.path.join(output_dir, f"{today}票星球音乐现场演出.xlsx"))
    
    print("\n" + "=" * 60)
    print("爬取完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
