"""raw-<brand>.json を正規化して site/data.js を作る。

- 素材表記(「本体: 53% 綿, 30% ポリエステル / リブ部分: ...」)を分解し、本体素材を [{n, p}] にする
- 「指定外繊維( ポリエステル )」のようにかっこ内に実体があれば、そちらで数える
- 解析できなかった表記は data/parse-misses.txt に書き出す(人が見て辞書を足す)
使い方: py -I scraper/build_data.py
"""
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(ROOT, "site", "data.js")

ALIASES = {
    "コットン": "綿", "綿": "綿", "オーガニックコットン": "綿",
    "麻": "麻", "亜麻": "麻", "リネン": "麻", "苧麻": "麻", "ラミー": "麻",
    "毛": "毛", "ウール": "毛", "毛(ウール)": "毛", "羊毛": "毛", "メリノウール": "毛", "ヤク": "毛", "アルパカ": "毛", "モヘヤ": "毛", "アンゴラ": "毛",
    "カシミヤ": "カシミヤ", "カシミア": "カシミヤ", "毛(カシミヤ)": "カシミヤ",
    "絹": "絹", "シルク": "絹",
    "レーヨン": "レーヨン", "ビスコース": "レーヨン",
    "リヨセル": "リヨセル", "テンセル™リヨセル": "リヨセル", "テンセル": "リヨセル", "テンセル™": "リヨセル", "リヨセル(テンセル™)": "リヨセル",
    "モダール": "モダール", "テンセル™モダール": "モダール",
    "キュプラ": "キュプラ", "アセテート": "アセテート", "トリアセテート": "アセテート",
    "ポリエステル": "ポリエステル", "再生ポリエステル": "ポリエステル", "リサイクルポリエステル": "ポリエステル",
    "ナイロン": "ナイロン", "ポリアミド": "ナイロン",
    "アクリル": "アクリル", "アクリル系": "アクリル", "モダクリル": "アクリル",
    "ポリウレタン": "ポリウレタン", "エラスタン": "ポリウレタン",
    "ポリプロピレン": "ポリプロピレン",
    "指定外繊維": "指定外繊維",
    "ダウン": "ダウン", "フェザー": "フェザー",
    "再生繊維(セルロース)": "レーヨン", "再生繊維": "レーヨン",
}
MAIN_LABELS = ("本体", "表地", "表側", "身生地", "身頃", "前身頃", "本体部分", "ボディ")
TOP_LABELS = ("表地", "裏地", "表側", "裏側", "リブ", "ポケット", "脇ポケット", "内ポケット", "胸ポケット", "別布", "衿", "袖口", "フード縁")
FILL_LABELS = ("中わた", "詰め物", "充てん", "中綿")
NOT_CLOTHES = re.compile(r"バッグ|スニーカー|サンダル|ブーツ|パンプス|ローファー|収納|傘")
# 機能・シリーズとして見せないタグ(素材名の言い換え・分類用)
TAG_SKIP = {"合繊", "コットン", "コットン混", "織布", "ラウンジその他", "ルームウェアその他", "天然素材ショーツ", "ウール",
            "アクリル", "機能性素材", "スウェット", "デニム", "デニムジーンズ", "その他", "ポリエステル", "布帛", "合成皮革",
            "綿", "レーヨン", "ナイロン"}
GENDER = {"MEN": "メンズ", "WOMEN": "ウィメンズ", "UNISEX": "ユニセックス", "KIDS": "キッズ", "BABY": "ベビー"}
misses = []

# カテゴリ: 公式の分類名(breadcrumbs)と商品名から、ブランド共通の分類に寄せる。上から順に判定
CATEGORY_RULES = [
    ("ルームウェア", ("ルームウェア", "パジャマ", "ラウンジ", "ルームシューズ")),
    ("インナー・肌着", ("インナー", "肌着", "ブラ", "ショーツ(下着)", "ボクサー", "トランクス", "ブリーフ", "キャミソール", "タンクトップ")),
    ("ソックス・小物", ("ソックス", "靴下", "タイツ", "レギンス", "ストッキング", "グローブ", "手袋", "マフラー", "ストール", "帽子", "キャップ", "ビーニー")),
    ("アウター", ("ダウン", "コート", "ジャケット", "ブルゾン", "アウター", "パフテック", "ベスト", "ジレ", "パーカー(アウター)")),
    ("スカート・ワンピース", ("ワンピース", "スカート", "ドレス", "サロペット", "オールインワン")),
    ("パンツ", ("パンツ", "ジーンズ", "デニム", "ショートパンツ", "ショーツ", "スラックス", "チノ", "ジョガー", "スウェットパンツ")),
    ("フリース", ("フリース",)),
    ("スウェット・パーカ", ("スウェット", "パーカ", "フーディ")),
    ("ニット・カーディガン", ("ニット", "セーター", "カーディガン")),
    ("シャツ・ブラウス", ("ブラウス", "シャツ")),
    ("Tシャツ・カットソー", ("Tシャツ", "カットソー", "ポロシャツ", "T")),
]


# 商品名にはっきり書いてある形の名前は公式の分類より優先する(例: 「スウェットバギーパンツ」はパンツ)
NAME_FIRST = [
    ("スカート・ワンピース", r"スカート|(?<!レ)スコート|ワンピース|サロペット"),
    ("ソックス・小物", r"グローブ|手袋|マフラー|ストール|ソックス|靴下|タイツ|ビーニー|キャップ|ハット"),
    ("ルームウェア", r"パジャマ|ラウンジセット|ルームウェア"),
    ("アウター", r"(?<!ス)コート|ブルゾン|ダウンジャケット|ダウンベスト|ダウンパーカ|ジャケット(?!ワンピース)"),
    ("パンツ", r"パンツ|ジーンズ|ジョガー|スラックス|チノ"),
    ("ニット・カーディガン", r"カーディガン|セーター"),
]


def classify(detail, name, fallback):
    for cat, pat in NAME_FIRST:
        if re.search(pat, name):
            return cat
    bc = (detail or {}).get("breadcrumbs") or {}
    texts = [(bc.get("subcategory") or {}).get("locale", ""), (bc.get("category") or {}).get("locale", ""), name]
    for text in texts:
        if not text:
            continue
        for cat, words in CATEGORY_RULES:
            for w in words:
                if w == "T":
                    if re.search(r"T(シャツ)?$|Tシャツ|ティー", text):
                        return cat
                    continue
                if w == "シャツ" and re.search(r"Tシャツ|ポロシャツ|スウェットシャツ", text) and "ブラウス" not in text:
                    continue
                if w == "ブラ" and not re.search(r"ブラ(?!ウス)", text):
                    continue
                if w == "ドレス" and "ドレスシャツ" in text:
                    continue
                if w == "ダウン" and "ボタンダウン" in text and "ダウン" not in text.replace("ボタンダウン", ""):
                    continue
                if w in text:
                    return cat
    return fallback


def norm_name(raw):
    s = raw.strip().replace("（", "(").replace("）", ")").replace(" ", "").replace("　", "")
    m = re.match(r"^(.+?)\((.+?)\)$", s)
    if m:
        outer, inner = m.group(1), m.group(2)
        if outer == "指定外繊維" or outer not in ALIASES:
            if inner in ALIASES:
                return ALIASES[inner]
        s = outer
    if s in ALIASES:
        return ALIASES[s]
    for k in sorted(ALIASES, key=len, reverse=True):  # 「再生ポリエステル繊維」なども拾う
        if k in s:
            return ALIASES[k]
    return None


def parse_items(text):
    out = []
    for part in re.split(r"[,、，・]", text):
        part = part.strip(" 　/")
        if not part:
            continue
        m = re.match(r"^(\d+(?:\.\d+)?)\s*%\s*(.+)$", part)
        if m:
            pct, name = float(m.group(1)), m.group(2)
        else:
            m = re.match(r"^(.+?)\s*(\d+(?:\.\d+)?)\s*%$", part)
            if not m:
                continue
            name, pct = m.group(1), float(m.group(2))
        n = norm_name(name)
        if n is None:
            misses.append(name)
            n = "その他"
        out.append([n, pct])
    merged = {}
    for n, pct in out:
        merged[n] = merged.get(n, 0) + pct
    return [{"n": n, "p": round(pct)} for n, pct in sorted(merged.items(), key=lambda x: -x[1])]


LABEL_RE = re.compile(r"([^\s:,、，・/%\d\[\]]{1,20})\s*:")  # 「刺繍糸(柄部分):」のようにかっこを含む見出しも拾う


def parse_composition(comp):
    """戻り値: (本体素材, 中わた素材, 部位一覧)
    対応する表記の例:
      ユニクロ: 「本体: 53% 綿, 30% ポリエステル ( 30% リサイクル…を使用 )/ リブ部分: 73% 綿, 27% …」
      GU:       「[02LIGHT GRAY]本体:綿95%・レーヨン5%,リブ部分:綿76%・… または …」
    """
    if not comp:
        return [], [], []
    import unicodedata
    t = unicodedata.normalize("NFKC", comp).replace("<br>", "\n")
    # 「[表地]」「[中わた]」のような部位の見出しは「表地:」に直す(色の見出しは英数字を含むので残る)
    t = re.sub(r"\[([^\]\dA-Za-z,]{1,8})\]", r"\1:", t)
    # GU の「(表側)ポリエステル100%」「(ボーダー)ポリエステル75%」のような、区切りの直後のかっこ見出しも「表側:」に直す
    # (「指定外繊維( ポリエステル )」のように素材名の後ろのかっこは対象外)
    t = re.sub(r"(^|[,:\n])\s*\(([^()%\d]{1,10})\)", r"\1\2:", t)
    # 色ごとに組成が違う表記は最初の色の分だけ使う
    chunks = [c for c in re.split(r"\[[^\]]*\]", t) if re.search(r"\d\s*%", c)]
    t = chunks[0] if chunks else t
    t = re.split(r"または|のうちどちらか", t)[0]
    # 「以下どちらかの組成」で候補が行ごとに並ぶ表記は最初の候補だけ使う
    lines = [re.sub(r"^\s*\d{5,}(?:\s*,\s*\d{5,})*\s*:\s*", "", ln) for ln in t.split("\n") if re.search(r"\d\s*%", ln)]
    t = lines[0] if lines else t
    # 「(リサイクル…を100%使用)」のような注記を除く(入れ子なし前提で2回)
    for _ in range(2):
        t = re.sub(r"\([^()]*(?:%|使用|繊維)[^()]*\)", "", t)
    marks = list(LABEL_RE.finditer(t))
    raw_segs = []
    if not marks:
        raw_segs.append(("", t))
    else:
        if marks[0].start() > 0 and re.search(r"\d\s*%", t[: marks[0].start()]):
            raw_segs.append(("", t[: marks[0].start()]))
        for i, m in enumerate(marks):
            end = marks[i + 1].start() if i + 1 < len(marks) else len(t)
            raw_segs.append((m.group(1), t[m.end():end]))
    # 「中わた: 本体: 90% ダウン」のように中身のない見出しは、次の見出しの親として引き継ぐ。
    # 親は「表地」「裏地」など最上位の見出しが出てくるまで続く
    segs, parent = [], ""
    for label, body in raw_segs:
        if label and any(label.startswith(k) for k in TOP_LABELS):
            parent = ""
        items = parse_items(body)
        full = f"{parent}/{label}" if parent and label else label
        if items:
            segs.append({"label": full, "items": items})
        elif label and not re.search(r"\d\s*%", body):
            parent = full
    if not segs:
        return [], [], []
    is_fill = lambda x: any(k in x["label"] for k in FILL_LABELS)  # noqa: E731
    main = next((x for x in segs if not is_fill(x) and x["label"].split("/")[0] in MAIN_LABELS), None) \
        or next((x for x in segs if not is_fill(x)), segs[0])
    fill = next((x for x in segs if is_fill(x)), None)
    return main["items"], (fill["items"] if fill else []), segs


def main():
    src = sys.argv[sys.argv.index("--src") + 1] if "--src" in sys.argv else DATA  # 例: --src data/next
    products, meta = [], {}
    for fn in sorted(os.listdir(src)):
        if not (fn.startswith("raw-") and fn.endswith(".json")):
            continue
        raw = json.load(open(os.path.join(src, fn), encoding="utf-8"))
        brand, host = raw["brand"], raw["host"]
        meta[brand] = {"fetchedAt": raw["fetchedAt"], "count": 0}
        for rec in raw["items"]:
            it, d = rec["list"], rec.get("detail") or {}
            pid, pg = it["productId"], it.get("priceGroup", "00")
            prices = it.get("prices") or {}
            base = (prices.get("base") or {}).get("value")
            promo = (prices.get("promo") or {}).get("value") or base
            if promo is None:
                continue
            if NOT_CLOTHES.search(it.get("name", "")):  # 服以外(バッグ・靴・収納)は載せない
                continue
            imgs = (it.get("images") or {}).get("main") or {}
            rep = it.get("representativeColorDisplayCode")
            img = (imgs.get(rep) or next(iter(imgs.values()), {})).get("image") if imgs else None
            hexmap = rec.get("hex") or {}
            colors = []
            for c in it.get("colors") or []:
                colors.append([c.get("name", ""), hexmap.get(c.get("code")) or "#cccccc", c.get("displayCode"), c.get("filterCode") or ""])
            mats, fill, segs = parse_composition(d.get("composition"))
            wash = (d.get("washingInformation") or "").replace(",", ", ").replace(",  ", ", ")
            # GU は「洗濯機」「手洗い」「ドライクリーニング」の一語表記なので、ユニクロの書き方にそろえる
            wash = {"洗濯機": "洗濯機可", "手洗い": "手洗い可", "ドライクリーニング": "ドライクリーニングのみ(水洗い不可)",
                    "家庭での洗濯禁止": "家庭での洗濯不可"}.get(wash, wash)
            rating = it.get("rating") or {}
            products.append({
                "id": f"{brand}-{pid}",
                "b": brand,
                "n": it.get("name", ""),
                "g": GENDER.get(it.get("genderCategory"), it.get("genderName") or ""),
                "cat": classify(d, it.get("name", ""), rec.get("category", "")),
                "tags": sorted({t["tagName"] for t in d.get("tags") or [] if t.get("group") in ("material", "function", "feature") and t.get("tagName") and t["tagName"] not in TAG_SKIP}),
                "p": int(promo),
                "bp": int(base) if base else int(promo),
                "img": img,
                "imgs": {k: v.get("image") for k, v in imgs.items()},
                "url": f"{host}/jp/ja/products/{pid}/{pg}",
                "col": colors,
                "sz": [s.get("name") for s in it.get("sizes") or [] if s.get("name")],
                "r": rating.get("average"),
                "rc": rating.get("count") or 0,
                "mat": mats,
                "fill": fill,
                "parts": segs,
                "comp": d.get("composition") or "",
                # 色や生産時期で組成が違う(公式に「どちらかの組成」「[色]ごとの組成」と書かれている)
                "alt": bool(re.search(r"どちらか|いずれか|または|\[[^\]]*\d[^\]]*\]", d.get("composition") or "")),
                "wash": wash,
                # 公式の価格表示(「11/12まで期間限定価格」「値下げ」など)。通常価格は一覧 API に無いので割引率は出せない
                "pf": [f.get("name") for f in ((it.get("representative") or {}).get("flags") or {}).get("priceFlags") or [] if f.get("name")],
                "machine": "洗濯機" in wash and "不可" not in wash.split("洗濯機")[1][:3],
                "hand": "手洗い" in wash,
            })
            meta[brand]["count"] += 1
    # 同名・同価格・同対象の商品(柄違い・限定色など)は1枚のカードにまとめる
    merged, order = {}, []
    for pr in products:
        key = (pr["b"], pr["n"], pr["g"], pr["p"], tuple((m["n"], m["p"]) for m in pr["mat"]))
        if key not in merged:
            pr["v"] = 1
            merged[key] = pr
            order.append(key)
            continue
        base = merged[key]
        base["v"] += 1
        names = {c[0] for c in base["col"]}
        base["col"] += [c for c in pr["col"] if c[0] not in names]
        base["sz"] += [z for z in pr["sz"] if z not in base["sz"]]
        if (pr["rc"] or 0) > (base["rc"] or 0):
            base["r"], base["rc"] = pr["r"], pr["rc"]
        base["tags"] = sorted(set(base["tags"]) | set(pr["tags"]))
    products = [merged[k] for k in order]
    for b in meta:
        meta[b]["count"] = sum(1 for pr in products if pr["b"] == b)
    data = {"generatedAt": __import__("time").strftime("%Y-%m-%d"), "brands": meta, "products": products}
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* 自動生成: scraper/build_data.py。手で編集しない */\nwindow.SN_DATA = ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    with open(os.path.join(DATA, "parse-misses.txt"), "w", encoding="utf-8") as f:
        for name in sorted(set(misses)):
            f.write(name + "\n")
    no_mat = sum(1 for p in products if not p["mat"])
    print(f"商品 {len(products)}件 / 素材なし {no_mat}件 / 未知の素材名 {len(set(misses))}種 → {OUT}")


if __name__ == "__main__":
    main()
