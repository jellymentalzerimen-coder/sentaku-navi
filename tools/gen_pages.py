"""site/data.js からカテゴリ別・洗濯条件別の固定ページを作る(検索で見つけてもらうため)

- site/cat/<slug>.html … カテゴリごと
- site/care/<slug>.html … 洗濯条件ごと(公式の洗濯表示から読み取れたものだけ)
- site/browse.html … 上の一覧
水増しはしない: 該当が MIN_ITEMS 件未満のページは作らない。件数・取得日はすべて data.js から数える。
既存の site/cat/*.html と site/care/*.html は作り直す前に消す(このスクリプトだけが作るファイル)。
使い方: py -I tools/gen_pages.py
"""
import html
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")
# canonical などの絶対 URL は入れない: 公開 URL にアカウント名が含まれ、tools/export_public.sh の個人情報チェックに掛かるため(扱いは人間が決める)
MIN_ITEMS = 5

src = open(os.path.join(SITE, "data.js"), encoding="utf-8").read()
DATA = json.loads(src[src.index("=") + 1:].strip().rstrip(";"))
P = DATA["products"]
BRAND_LABEL = {"uniqlo": "ユニクロ", "gu": "GU", "muji": "無印良品"}

# カテゴリ名 → URL の名前。ここに無いカテゴリはページを作らない(警告を出す)
CAT_SLUG = {
    "Tシャツ・カットソー": "tshirt", "シャツ・ブラウス": "shirt", "ニット・カーディガン": "knit",
    "スウェット・パーカ": "sweat", "フリース": "fleece", "アウター": "outer", "パンツ": "pants",
    "スカート・ワンピース": "skirt-dress", "ルームウェア": "roomwear", "インナー・肌着": "inner",
    "ソックス・小物": "socks",
}


def care(p):
    c = p.get("care") or {}
    return c if c else {"machine": "可" if p.get("machine") else None, "hand": bool(p.get("hand")), "dryer": None, "dry": None}


# app.js の CARE_OPTS と同じ判定(「手洗いできる」はほぼ全件になり一覧として役に立たないので作らない)。URL の cr= は app.js の絞り込みキー
CARE_PAGES = [
    ("washer-ok", "m", "洗濯機で洗える服", "公式の洗濯表示で洗濯機洗いができる(洗濯ネット使用を含む)",
     lambda c: c.get("machine") in ("可", "ネット")),
    ("washer-no-net", "m0", "洗濯ネットなしで洗濯機で洗える服", "公式の洗濯表示で洗濯機洗いができ、洗濯ネットの指定がない",
     lambda c: c.get("machine") == "可"),
    ("dryer-ok", "d", "乾燥機OKの服", "公式の洗濯表示でタンブル乾燥(乾燥機)ができる",
     lambda c: c.get("dryer") == "可"),
]


def wash_label(c):
    m = c.get("machine")
    if m == "可":
        return "洗濯機OK", "ok"
    if m == "ネット":
        return "洗濯機OK(ネット)", "ok"
    if m == "不可":
        return ("手洗いのみ" if c.get("hand") else "家で洗えない"), "ng"
    return "洗濯表示なし", "na"


def dryer_label(c):
    return {"可": ("乾燥機OK", "ok"), "不可": ("乾燥機NG", "ng")}.get(c.get("dryer"), ("乾燥機 表示なし", "na"))


e = html.escape
fetched = sorted({v["fetchedAt"] for v in DATA["brands"].values()})
fetched_txt = "・".join(fetched)


def brand_names(items):
    bs = sorted({p["b"] for p in items}, key=lambda b: list(BRAND_LABEL).index(b) if b in BRAND_LABEL else 99)
    return "・".join(BRAND_LABEL.get(b, b) for b in bs)


def stats(items):
    cs = [care(p) for p in items]
    return [
        ("洗濯機OK", sum(c.get("machine") in ("可", "ネット") for c in cs)),
        ("うちネット不要", sum(c.get("machine") == "可" for c in cs)),
        ("手洗いのみ", sum(c.get("machine") == "不可" and bool(c.get("hand")) for c in cs)),
        ("家で洗えない", sum(c.get("machine") == "不可" and not c.get("hand") for c in cs)),
        ("乾燥機OK", sum(c.get("dryer") == "可" for c in cs)),
    ]


def mat_text(p):
    return "・".join(f"{m['n']}{m['p']}%" for m in p["mat"]) or "素材表示なし"


def item_html(p, up):
    c = care(p)
    wl, wc = wash_label(c)
    dl, dc = dryer_label(c)
    detail = f"{up}index.html#open={e(p['id'])}"
    price = f"¥{p['p']:,}" if p.get("p") else "価格不明"
    return (
        f'<li class="sp-item"><a class="sp-name" href="{detail}">{e(p["n"])}</a>'
        f'<div class="sp-meta"><span>{e(BRAND_LABEL.get(p["b"], p["b"]))}</span><span>{e(p.get("g", ""))}</span>'
        f'<span>{price}</span><span>{e(mat_text(p))}</span></div>'
        f'<div class="careb"><span class="cb {wc}">{e(wl)}</span><span class="cb {dc}">{e(dl)}</span></div></li>'
    )


def page(path, title, h1, desc, lead, crumbs, items, app_hash, nav):
    up = "../" * path.count("/")
    crumb_html = " › ".join(
        f'<a href="{up}{href}">{e(name)}</a>' if href is not None else f"<span>{e(name)}</span>" for name, href in crumbs
    )
    st = "".join(f"<li><span>{e(k)}</span><b>{v}件</b></li>" for k, v in stats(items))
    items = sorted(items, key=lambda p: (list(BRAND_LABEL).index(p["b"]) if p["b"] in BRAND_LABEL else 99, p.get("p") or 0, p["n"]))
    lis = "\n".join(item_html(p, up) for p in items)
    cur = ' aria-current="page"'
    nav_html = "".join(
        f'<li><a href="{up}{href}"{cur if href == path else ""}>{e(name)}({n})</a></li>' for name, href, n in nav
    )
    return f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="theme-color" content="#1f5f8b">
<meta property="og:type" content="website">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%231f5f8b'/%3E%3Cpath d='M9 11l4-4h6l4 4-3 3v11H12V14z' fill='%23fff'/%3E%3C/svg%3E">
<link rel="stylesheet" href="{up}style.css">
</head>
<body class="sp">
<header class="top"><div class="top-inner"><a class="logo" href="{up}index.html">洗濯ナビ<span class="logo-sub">服を素材と洗濯表示で選ぶ</span></a></div></header>
<main class="sp-main">
<nav class="sp-crumb" aria-label="パンくず">{crumb_html}</nav>
<h1>{e(h1)}</h1>
<p class="sp-lead">{e(lead)}</p>
<ul class="sp-stats" aria-label="洗濯表示の内訳">{st}</ul>
<p><a class="primary-btn sp-go" href="{up}index.html#{e(app_hash)}">洗濯ナビで絞り込んで比べる</a></p>
<h2>{len(items)}件の一覧(ブランド・価格順)</h2>
<ul class="sp-list">
{lis}
</ul>
<h2>ほかの条件で探す</h2>
<ul class="sp-nav">{nav_html}</ul>
</main>
<footer class="foot">
<p><strong>非公式サイトです。</strong>掲載ブランドとは関係ありません。価格・在庫・素材は取得時点({e(fetched_txt)})の参考情報です。購入前に必ず公式サイトで確認してください。</p>
<p>洗濯表示は公式サイトの表記を読み取ったものです。読み取れない時は「表示なし」としています。洗う前に実物の洗濯表示(タグ)を確認してください。</p>
</footer>
</body>
</html>
"""


def by_cat():
    out, warn = [], set()
    for cat in sorted({p["cat"] for p in P}):
        items = [p for p in P if p["cat"] == cat]
        slug = CAT_SLUG.get(cat)
        if not slug:
            warn.add(cat)
            continue
        if len(items) < MIN_ITEMS:
            continue
        out.append((cat, f"cat/{slug}.html", items))
    for w in sorted(warn):
        print(f"警告: カテゴリ「{w}」の URL 名が CAT_SLUG に無いのでページを作りません")
    return out


def by_care():
    out = []
    for slug, key, name, rule, fn in CARE_PAGES:
        items = [p for p in P if fn(care(p))]
        if len(items) >= MIN_ITEMS:
            out.append((slug, key, name, rule, f"care/{slug}.html", items))
    return out


def main():
    from urllib.parse import quote
    cats, cares = by_cat(), by_care()
    used = [path for _, path, _ in cats]
    if len(used) != len(set(used)):
        sys.exit("CAT_SLUG の URL 名が重複しています")
    nav = [(cat, path, len(items)) for cat, path, items in cats] + [(name, path, len(items)) for _, _, name, _, path, items in cares]
    for d in ("cat", "care"):
        os.makedirs(os.path.join(SITE, d), exist_ok=True)
        for f in os.listdir(os.path.join(SITE, d)):
            if f.endswith(".html"):
                os.remove(os.path.join(SITE, d, f))
    written = []
    for cat, path, items in cats:
        bn = brand_names(items)
        title = f"{cat}を洗濯表示と素材で比べる({bn}{len(items)}件)| 洗濯ナビ"
        desc = f"{bn}の{cat}{len(items)}件を、洗濯機・乾燥機の可否(公式の洗濯表示)と素材の混率で一覧。{fetched_txt}時点の非公式まとめ。"
        lead = f"{bn}の{cat}{len(items)}件({fetched_txt}時点)を、公式の洗濯表示から読み取った洗濯機・乾燥機の可否と素材の混率で並べた一覧です。"
        crumbs = [("洗濯ナビ", "index.html"), ("カテゴリ・条件から探す", "browse.html"), (cat, None)]
        written.append((path, page(path, title, f"{cat}の洗濯表示と素材", desc, lead, crumbs, items, "c=" + quote(cat), nav)))
    for slug, key, name, rule, path, items in cares:
        bn = brand_names(items)
        title = f"{name}({bn}{len(items)}件)| 洗濯ナビ"
        desc = f"{bn}の服のうち、{rule}もの{len(items)}件の一覧。{fetched_txt}時点の非公式まとめ。"
        lead = f"{brand_names(P)}の服{len(P)}件のうち、{rule}もの{len(items)}件({fetched_txt}時点)の一覧です。"
        crumbs = [("洗濯ナビ", "index.html"), ("カテゴリ・条件から探す", "browse.html"), (name, None)]
        written.append((path, page(path, title, name, desc, lead, crumbs, items, "cr=" + key, nav)))
    for path, body in written:
        with open(os.path.join(SITE, path), "w", encoding="utf-8", newline="\n") as f:
            f.write(body)
    # 一覧ページ
    lis_cat = "".join(f'<li><a href="{path}">{e(cat)}</a> <span>{len(items)}件</span></li>' for cat, path, items in cats)
    lis_care = "".join(f'<li><a href="{path}">{e(name)}</a> <span>{len(items)}件</span></li>' for _, _, name, _, path, items in cares)
    bn = brand_names(P)
    browse = f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>カテゴリ・洗濯条件から探す | 洗濯ナビ</title>
<meta name="description" content="{e(bn)}の服{len(P)}件を、カテゴリ別・洗濯条件別(洗濯機・乾燥機)に一覧できるページの目次。{e(fetched_txt)}時点の非公式まとめ。">
<meta name="theme-color" content="#1f5f8b">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%231f5f8b'/%3E%3Cpath d='M9 11l4-4h6l4 4-3 3v11H12V14z' fill='%23fff'/%3E%3C/svg%3E">
<link rel="stylesheet" href="style.css">
</head>
<body class="sp">
<header class="top"><div class="top-inner"><a class="logo" href="index.html">洗濯ナビ<span class="logo-sub">服を素材と洗濯表示で選ぶ</span></a></div></header>
<main class="sp-main">
<nav class="sp-crumb" aria-label="パンくず"><a href="index.html">洗濯ナビ</a> › <span>カテゴリ・条件から探す</span></nav>
<h1>カテゴリ・洗濯条件から探す</h1>
<p class="sp-lead">{e(bn)}の服{len(P)}件({e(fetched_txt)}時点)をカテゴリ別・洗濯条件別に一覧できます。{MIN_ITEMS}件未満の分類はページを作っていません。</p>
<h2>カテゴリ</h2>
<ul class="sp-nav">{lis_cat}</ul>
<h2>洗濯条件(公式の洗濯表示から)</h2>
<ul class="sp-nav">{lis_care}</ul>
</main>
<footer class="foot">
<p><strong>非公式サイトです。</strong>掲載ブランドとは関係ありません。価格・在庫・素材は取得時点の参考情報です。購入前に必ず公式サイトで確認してください。</p>
<p>洗濯機・乾燥機の可否は、公式の洗濯表示と取り扱い注意の文から読み取ったものです。洗う前に実物のタグを確認してください。</p>
</footer>
</body>
</html>
"""
    with open(os.path.join(SITE, "browse.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(browse)
    print(f"固定ページ {len(written)}件 + browse.html を作りました")
    for path, n in [(path, len(items)) for _, path, items in cats] + [(path, len(items)) for *_, path, items in cares]:
        print(f"  {path}: {n}件")


if __name__ == "__main__":
    main()
