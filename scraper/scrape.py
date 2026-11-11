"""選択ナビ 商品収集スクリプト (ユニクロ / GU)

方針(行儀よく集める):
- robots.txt で禁止されていない商品 API だけを使う(検索結果ページ /search?q= はクロールしない)
- 1リクエストごとに DELAY 秒待つ。同時接続しない
- 取るのは事実情報(名前・価格・素材・色・サイズ・評価)と画像の URL だけ。画像そのものは保存しない
- 失敗したブランドは前回データを残す(壊さない)

使い方: py -I scraper/scrape.py [--per 20] [--brands uniqlo,gu] [--queries Tシャツ,ニット]
出力: data/raw-<brand>.json → build_data.py で site/data.js にまとめる
"""
import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
DELAY = 1.5
UA = "Mozilla/5.0 (compatible; sentaku-navi/0.2; unofficial material-comparison site; 1 req per 1.5s)"

BRANDS = {
    "uniqlo": {"host": "https://www.uniqlo.com", "label": "ユニクロ"},
    "gu": {"host": "https://www.gu-global.com", "label": "GU"},
}

# 検索語 → サイト内カテゴリ(表示用)
QUERIES = {
    "Tシャツ": "Tシャツ・カットソー",
    "シャツ": "シャツ・ブラウス",
    "ニット": "ニット・セーター",
    "スウェット": "スウェット・パーカ",
    "パーカ": "スウェット・パーカ",
    "フリース": "フリース",
    "ジャケット": "アウター",
    "コート": "アウター",
    "ダウン": "アウター",
    "パンツ": "パンツ",
    "ジーンズ": "パンツ",
    "スカート": "スカート・ワンピース",
    "ワンピース": "スカート・ワンピース",
    "インナー": "インナー・肌着",
    "ルームウェア": "ルームウェア",
    "靴下": "ソックス・小物",
    # 素材から探す人向けの検索語(カテゴリは build_data.py が商品名と公式分類から決め直す)
    "カーディガン": "ニット・カーディガン",
    "ブラウス": "シャツ・ブラウス",
    "ポロシャツ": "Tシャツ・カットソー",
    "リネン": "シャツ・ブラウス",
    "ウール": "ニット・カーディガン",
    "カシミヤ": "ニット・カーディガン",
    "コットン": "Tシャツ・カットソー",
    "ヒートテック": "インナー・肌着",
    "エアリズム": "インナー・肌着",
    "パジャマ": "ルームウェア",
    "レギンス": "ソックス・小物",
    "マフラー": "ソックス・小物",
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8")
    time.sleep(DELAY)
    return json.loads(body)


def list_products(host, q, limit):
    qs = urllib.parse.urlencode({"q": q, "limit": limit, "offset": 0, "httpFailure": "true"})
    d = get(f"{host}/jp/api/commerce/v5/ja/products?{qs}")
    res = d.get("result", {})
    colors = {c["code"]: c.get("hexBackgroundColor") for c in res.get("aggregations", {}).get("colors", [])}
    return res.get("items", []), colors


def detail(host, pid, pg):
    d = get(f"{host}/jp/api/commerce/v5/ja/products/{pid}/price-groups/{pg}/details?includeModelSize=false&httpFailure=true")
    return d.get("result", {})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per", type=int, default=20, help="検索語ごとの最大件数")
    ap.add_argument("--brands", default="uniqlo,gu")
    ap.add_argument("--queries", default=",".join(QUERIES))
    ap.add_argument("--out", default=DATA, help="raw-<brand>.json の保存先(既定 data/)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    for brand in a.brands.split(","):
        cfg = BRANDS[brand]
        out_path = os.path.join(a.out, f"raw-{brand}.json")
        items = {}
        try:
            for q in a.queries.split(","):
                lst, hexmap = list_products(cfg["host"], q, a.per)
                print(f"[{brand}] {q}: {len(lst)}件", flush=True)
                for it in lst:
                    pid = it["productId"]
                    if pid in items:
                        continue
                    items[pid] = {"list": it, "query": q, "category": QUERIES.get(q, q), "hex": hexmap}
            for i, (pid, rec) in enumerate(items.items(), 1):
                try:
                    rec["detail"] = detail(cfg["host"], pid, rec["list"].get("priceGroup", "00"))
                except Exception as e:  # 1件の失敗で全体を止めない
                    rec["detail"] = None
                    print(f"  detail失敗 {pid}: {e}", flush=True)
                if i % 25 == 0:
                    print(f"[{brand}] 詳細 {i}/{len(items)}", flush=True)
        except Exception as e:
            print(f"[{brand}] 中断: {e}  (前回データを残す)", flush=True)
            if not items:
                continue
        # 無人実行で壊れたデータを出さない: 詳細が取れた件数が前回の半分未満なら上書きしない
        ok = sum(1 for r in items.values() if r.get("detail"))
        prev = 0
        if os.path.exists(out_path):
            try:
                with open(out_path, encoding="utf-8") as f:
                    prev = sum(1 for r in json.load(f).get("items", []) if r.get("detail"))
            except Exception:
                prev = 0
        if ok < prev * 0.5:
            print(f"[{brand}] 取得 {ok}件 < 前回 {prev}件の半分。前回データを残す", flush=True)
            continue
        payload = {"brand": brand, "fetchedAt": time.strftime("%Y-%m-%d"), "host": cfg["host"], "items": list(items.values())}
        tmp = out_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        os.replace(tmp, out_path)
        print(f"[{brand}] 保存 {len(items)}件 → {out_path}", flush=True)


if __name__ == "__main__":
    main()
