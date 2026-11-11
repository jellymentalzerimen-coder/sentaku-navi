"""site/data.js の品質チェック(データ更新のたびに実行する)

見るもの:
- 素材の混率の合計が 100% から外れる商品(解析ミスの兆候)
- 素材なし・画像なし・価格なし
- カテゴリ・厚さに関わる単語の矛盾(例: 名前に「パンツ」なのにパンツ以外)
終了コード: 問題が閾値を超えたら 1
使い方: py -I tools/check_data.py
"""
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, "site", "data.js"), encoding="utf-8").read()
data = json.loads(src[src.index("=") + 1:].strip().rstrip(";"))
P = data["products"]

bad_sum = [p for p in P if p["mat"] and abs(sum(m["p"] for m in p["mat"]) - 100) > 1]
no_mat = [p for p in P if not p["mat"]]
no_img = [p for p in P if not p.get("img")]
no_price = [p for p in P if not p.get("p")]
NAME_CAT = [(r"パンツ|ジーンズ", "パンツ"), (r"スカート|ワンピース", "スカート・ワンピース"), (r"ブラウス", "シャツ・ブラウス")]
mismatch = [(p["n"], p["cat"]) for p in P for pat, cat in NAME_CAT
            if re.search(pat, p["n"]) and p["cat"] != cat and not re.search(r"セット|パジャマ", p["n"])]

print(f"商品 {len(P)}件 " + " / ".join(f"{b}: {v['count']}件({v['fetchedAt']})" for b, v in data["brands"].items()))
print(f"混率の合計ずれ: {len(bad_sum)}件")
for p in bad_sum[:10]:
    print("   ", p["b"], p["n"], p["mat"])
print(f"素材なし: {len(no_mat)}件 {[p['n'] for p in no_mat][:5]}")
print(f"画像なし: {len(no_img)}件 / 価格なし: {len(no_price)}件")
print(f"名前とカテゴリの食い違い: {len(mismatch)}件 {mismatch[:8]}")

problems = len(bad_sum) + len(no_price) + len(mismatch)
limit = max(5, len(P) // 50)  # 2% まで許容
# 定期実行用: ブランドごとの件数が下限を割ったら(取得失敗・遮断の兆候)公開しない
min_brand = int(os.environ.get("MIN_BRAND", "0"))
few = [b for b, v in data["brands"].items() if v["count"] < min_brand]
if min_brand and len(data["brands"]) < 2:
    few.append("ブランド欠け")
if few:
    print(f"件数不足: {few}(下限 {min_brand}件)")
ok = problems <= limit and not few
print("判定:", "OK" if ok else f"NG(問題 {problems}件 / 許容 {limit}件 / 件数不足 {few})")
sys.exit(0 if ok else 1)
