"""洗濯ナビ 商品収集スクリプト (ユニクロ / GU)

方針(行儀よく集める):
- robots.txt で禁止されていない商品 API だけを使う(検索結果ページ /search?q= はクロールしない)
- 1リクエストごとに DELAY 秒待つ。同時接続しない
- 取るのは事実情報(名前・価格・素材・洗濯表示・色・サイズ・評価)と画像の URL だけ。画像そのものは保存しない
- 一覧は検索語ごとに全ページ取る(価格・在庫は毎回新しくする)
- 詳細(素材・洗濯表示)は変わりにくいので data/cache/ に保存し、新商品と古くなった分だけ取りに行く(差分取得)
- 取れた件数が前回の半分未満なら上書きしない(遮断・障害で壊れたデータを公開しない)

使い方: py -I scraper/scrape.py [--brands uniqlo,gu] [--queries Tシャツ,ニット] [--max-pages N] [--max-detail N]
出力: data/raw-<brand>.json → build_data.py で site/data.js にまとめる
      data/cache/details-<brand>.json.gz(詳細のキャッシュ)
"""
import argparse
import gzip
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
PAGE = 100            # 一覧 API の1ページ最大件数(200 は 400 エラー)
REFRESH_DAYS = 56     # 詳細をこの日数より古ければ取り直す
MAX_REFRESH = 400     # 1回に取り直す古い詳細の上限(新商品は別枠で全部取る)
DETAIL_KEYS = ("composition", "washingInformation", "careInstruction", "tags", "breadcrumbs")
UA = "Mozilla/5.0 (compatible; sentaku-navi/0.2; unofficial material-comparison site; 1 req per 1.5s)"

BRANDS = {
    "uniqlo": {"host": "https://www.uniqlo.com", "label": "ユニクロ"},
    "gu": {"host": "https://www.gu-global.com", "label": "GU"},
}

# 検索語 → サイト内カテゴリ(表示用。build_data.py が商品名と公式分類から決め直す)
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

N_REQ = 0


def get(url):
    global N_REQ
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    last = None
    for attempt in range(3):  # 一時的な失敗は間隔を空けて2回まで再試行
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read().decode("utf-8")
            N_REQ += 1
            time.sleep(DELAY)
            return json.loads(body)
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (400, 403, 404):
                time.sleep(DELAY)
                raise
        except Exception as e:  # noqa: BLE001
            last = e
        time.sleep(DELAY * (4 ** (attempt + 1)))
    raise last


def list_all(host, q, max_pages):
    """検索語の全ページを取る。返り値: (商品リスト, 色コード→hex)"""
    items, colors, offset, total = [], {}, 0, None
    for _ in range(max_pages):
        qs = urllib.parse.urlencode({"q": q, "limit": PAGE, "offset": offset, "httpFailure": "true"})
        res = get(f"{host}/jp/api/commerce/v5/ja/products?{qs}").get("result", {})
        page = res.get("items", [])
        for c in res.get("aggregations", {}).get("colors", []):
            colors[c["code"]] = c.get("hexBackgroundColor")
        items += page
        total = (res.get("pagination") or {}).get("total", 0)
        offset += PAGE
        if not page or offset >= total:
            break
    return items, colors, total


def detail(host, pid, pg):
    d = get(f"{host}/jp/api/commerce/v5/ja/products/{pid}/price-groups/{pg}/details?includeModelSize=false&httpFailure=true")
    r = d.get("result", {})
    return {k: r.get(k) for k in DETAIL_KEYS}


def load_json(path, default):
    if not os.path.exists(path):
        return default
    try:
        op = gzip.open if path.endswith(".gz") else open
        with op(path, "rt", encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return default


def save_json(path, obj):
    tmp = path + ".tmp"
    op = gzip.open if path.endswith(".gz") else open
    with op(tmp, "wt", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--brands", default="uniqlo,gu")
    ap.add_argument("--queries", default=",".join(QUERIES))
    ap.add_argument("--max-pages", type=int, default=50, help="検索語ごとの最大ページ数(1ページ100件)")
    ap.add_argument("--max-detail", type=int, default=100000, help="1回に取る詳細の上限(試験用)")
    ap.add_argument("--out", default=DATA, help="raw-<brand>.json の保存先(既定 data/)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    cache_dir = os.path.join(a.out, "cache")
    os.makedirs(cache_dir, exist_ok=True)
    today = time.strftime("%Y-%m-%d")
    now = time.time()

    for brand in a.brands.split(","):
        cfg = BRANDS[brand]
        out_path = os.path.join(a.out, f"raw-{brand}.json")
        cache_path = os.path.join(cache_dir, f"details-{brand}.json.gz")
        cache = load_json(cache_path, {})
        prev_items = load_json(out_path, {}).get("items", [])
        if not cache:  # 初回: 前回の raw にある詳細をキャッシュの種にする(取り直しを減らす)
            for r in prev_items:
                if r.get("detail"):
                    k = f'{r["list"]["productId"]}/{r["list"].get("priceGroup", "00")}'
                    cache[k] = {"t": now, "d": {x: r["detail"].get(x) for x in DETAIL_KEYS}}
            if cache:
                print(f"[{brand}] 前回データから詳細 {len(cache)}件を引き継ぎ", flush=True)
        items = {}
        hexmap = {}
        try:
            for q in a.queries.split(","):
                lst, hx, total = list_all(cfg["host"], q, a.max_pages)
                hexmap.update(hx)
                new = 0
                for it in lst:
                    key = f'{it["productId"]}/{it.get("priceGroup", "00")}'
                    if key not in items:
                        items[key] = {"list": it, "query": q, "category": QUERIES.get(q, q)}
                        new += 1
                print(f"[{brand}] {q}: {len(lst)}/{total}件(新規 {new})", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"[{brand}] 一覧で中断: {e}  (前回データを残す)", flush=True)
            continue

        # 詳細: キャッシュに無いもの全部 + 古いものを最大 MAX_REFRESH 件
        missing = [k for k in items if k not in cache]
        stale = sorted((k for k in items if k in cache and now - cache[k].get("t", 0) > REFRESH_DAYS * 86400),
                       key=lambda k: cache[k].get("t", 0))[:MAX_REFRESH]
        todo = (missing + stale)[:a.max_detail]
        print(f"[{brand}] 一覧 {len(items)}件 / 詳細を取る {len(todo)}件(新規 {len(missing)}・更新 {len(stale)})", flush=True)
        fails = 0
        for i, key in enumerate(todo, 1):
            pid, pg = key.split("/")
            try:
                cache[key] = {"t": now, "d": detail(cfg["host"], pid, pg)}
            except Exception as e:  # noqa: BLE001
                fails += 1
                print(f"  詳細失敗 {key}: {e}", flush=True)
                if fails >= 30 and fails > i // 2:
                    print(f"[{brand}] 失敗が多いので詳細取得を打ち切る", flush=True)
                    break
            if i % 100 == 0:
                print(f"[{brand}] 詳細 {i}/{len(todo)}", flush=True)
                save_json(cache_path, cache)  # 途中でも保存(長時間実行の中断に備える)
        # 一覧から消えた商品のキャッシュは捨てる
        cache = {k: v for k, v in cache.items() if k in items}
        save_json(cache_path, cache)

        for key, rec in items.items():
            rec["detail"] = (cache.get(key) or {}).get("d")
        ok = sum(1 for r in items.values() if r.get("detail"))
        prev_ok = sum(1 for r in prev_items if r.get("detail"))
        if ok < prev_ok * 0.5:
            print(f"[{brand}] 詳細あり {ok}件 < 前回 {prev_ok}件の半分。前回データを残す", flush=True)
            continue
        save_json(out_path, {"brand": brand, "fetchedAt": today, "host": cfg["host"], "hex": hexmap,
                             "items": list(items.values())})
        print(f"[{brand}] 保存 {len(items)}件(詳細あり {ok})→ {out_path}", flush=True)
    print(f"リクエスト数 {N_REQ}", flush=True)


if __name__ == "__main__":
    main()
