/* 洗濯ナビ — 検索・絞り込み・並べ替え・比較(ビルド不要の素の JS) */
(() => {
  "use strict";
  const DATA = window.SN_DATA || { products: [], brands: {} };
  const CONFIG = Object.assign({ images: true }, window.SN_CONFIG || {});
  const TRAITS = window.SN_TRAITS;
  const MATS = window.SN_MATERIALS;
  const DRY = window.SN_DRYER || {};
  const DRY_LABEL = ["不向き", "注意", "向く"];
  // 素材から見た乾燥機の向き不向き(目安): 本体の10%以上を占める素材のうち一番弱いものに合わせる
  function dryerFit(p) {
    const ms = p.mat.filter((m) => m.p >= 10 && DRY[m.n]);
    const cover = p.mat.filter((m) => DRY[m.n]).reduce((a, m) => a + m.p, 0);
    if (!ms.length || cover < 50) return null;
    const lv = Math.min(...ms.map((m) => DRY[m.n].lv));
    return { lv, by: ms.filter((m) => DRY[m.n].lv === lv).map((m) => m.n) };
  }
  // 洗濯表示(公式)の読み取り結果を短い言葉にする
  const washLabel = (c) => ({ 可: "洗濯機OK", ネット: "洗濯機OK(ネット)", 不可: c.hand ? "手洗いのみ" : "家で洗えない" }[c.machine] || "洗濯表示なし");
  const dryerLabel = (c) => ({ 可: "乾燥機OK", 不可: "乾燥機NG" }[c.dryer] || "乾燥機 表示なし");
  const CARE_OPTS = [
    ["m", "洗濯機で洗える", (p) => p.care.machine === "可" || p.care.machine === "ネット"],
    ["m0", "ネットなしで洗濯機OK", (p) => p.care.machine === "可"],
    ["h", "手洗いできる", (p) => p.care.hand || p.care.machine === "可" || p.care.machine === "ネット"],
    ["d", "乾燥機OK(公式表示)", (p) => p.care.dryer === "可"],
    ["dm", "乾燥機に向く素材(目安)", (p) => !!p.dm && p.dm.lv === 2],
    ["dm1", "乾燥機に不向きな素材なし(目安)", (p) => !!p.dm && p.dm.lv >= 1],
  ];
  const CARE_FN = Object.fromEntries(CARE_OPTS.map(([k, , f]) => [k, f]));
  const CARE_NAME = Object.fromEntries(CARE_OPTS.map(([k, l]) => [k, l]));
  const BRAND_LABEL = { uniqlo: "ユニクロ", gu: "GU", muji: "無印良品" };
  const MAX_CMP = 4;
  const PAGE = 60;
  const SYNTHETIC = ["ポリエステル", "ナイロン", "アクリル", "ポリウレタン", "ポリプロピレン"];
  const MAT_COLOR = {
    綿: "#d9b26f", 麻: "#9bb57a", 毛: "#b07d5b", カシミヤ: "#8d5a97", 絹: "#e0a3b5", レーヨン: "#6fb3c6",
    リヨセル: "#4f9fa8", モダール: "#7cc2b0", キュプラ: "#5f8fd0", アセテート: "#a2a8d6", ポリエステル: "#6c7a89",
    ナイロン: "#44546a", アクリル: "#c98b4a", ポリウレタン: "#d16a6a", ポリプロピレン: "#9a9a9a",
    指定外繊維: "#b9b4a8", ダウン: "#efe6d0", フェザー: "#d8ccb0", その他: "#cfcac0",
  };
  // 公式データの色グループ(filterCode)→ 表示名。スウォッチの色は公式の代表色
  const COLOR_FAMILY = {
    WHITE: "白", GRAY: "グレー", BLACK: "黒", PINK: "ピンク", RED: "赤", ORANGE: "オレンジ", BEIGE: "ベージュ",
    BROWN: "ブラウン", YELLOW: "イエロー", GREEN: "グリーン", BLUE: "ブルー", NAVY: "ネイビー", PURPLE: "パープル", OTHER: "その他",
  };
  // 公式の英語の色名 → カタカナ(単語ごと)
  const COLOR_WORDS = {
    OFF: "オフ", WHITE: "ホワイト", LIGHT: "ライト", DARK: "ダーク", GRAY: "グレー", GREY: "グレー", BLACK: "ブラック", NAVY: "ネイビー",
    BLUE: "ブルー", RED: "レッド", WINE: "ワイン", PINK: "ピンク", ORANGE: "オレンジ", YELLOW: "イエロー", CREAM: "クリーム",
    BEIGE: "ベージュ", NATURAL: "ナチュラル", BROWN: "ブラウン", KHAKI: "カーキ", OLIVE: "オリーブ", GREEN: "グリーン",
    PURPLE: "パープル", CHARCOAL: "チャコール", MOCHA: "モカ", CAMEL: "キャメル", TAN: "タン", SILVER: "シルバー", GOLD: "ゴールド",
  };
  // 公式データの色は「色グループの代表色」(原色に近い)なので、見本は落ち着いた色に置き換える
  const MUTED = {
    WHITE: "#f7f6f2", GRAY: "#a9a9a6", BLACK: "#2b2b2b", PINK: "#e9aebb", RED: "#b8433a", ORANGE: "#e0893c", BEIGE: "#dccdb0",
    BROWN: "#7a573d", YELLOW: "#e9d46d", GREEN: "#5f7f4b", BLUE: "#4c6f9f", NAVY: "#26324f", PURPLE: "#76598a",
  };
  const NAMED = { NAVY: "#26324f", WINE: "#6d2335", OLIVE: "#6b6b3a", KHAKI: "#8a7d55", CREAM: "#f2e9cf", NATURAL: "#e8dfcb", CHARCOAL: "#3f4045", "OFF WHITE": "#f1eee4" };
  const mix = (hex, to, t) => {
    const h = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    const [a, b] = [h(hex), h(to)];
    return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
  };
  function colorHex(c) {
    const name = String(c[0] || "").toUpperCase();
    if (NAMED[name]) return NAMED[name];
    const word = Object.keys(NAMED).find((w) => name.split(/\s+/).includes(w));
    let base = (word && NAMED[word]) || MUTED[c[3]] || c[1] || "#cccccc";
    if (/^#[0-9a-f]{6}$/i.test(base)) {
      if (/\bLIGHT\b/.test(name)) base = mix(base, "#ffffff", 0.45);
      if (/\bDARK\b/.test(name)) base = mix(base, "#000000", 0.35);
    }
    return base;
  }
  const jpColor = (name) =>String(name || "").split(/\s+/).map((w) => COLOR_WORDS[w.toUpperCase()] || w).join("");
  const SIZE_ORDER =["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL"];

  /* ---------- 前処理 ---------- */
  const kana = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const norm = (s) => kana(String(s || "").normalize("NFKC").toLowerCase());
  const yen = (n) => "¥" + Number(n).toLocaleString("ja-JP");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const famOf = (c) => COLOR_FAMILY[c[3]] || (c[3] ? "その他" : null);
  const FAM_HEX = {};

  function traitsOf(p) {
    const known = p.mat.filter((m) => MATS[m.n] && MATS[m.n].t);
    const cover = known.reduce((a, m) => a + m.p, 0);
    if (!cover || cover < 50) return null;
    const t = {};
    for (const tr of TRAITS) t[tr.key] = known.reduce((a, m) => a + MATS[m.n].t[tr.key] * m.p, 0) / cover;
    const pu = (p.mat.find((m) => m.n === "ポリウレタン") || {}).p || 0;
    if (pu >= 2) t.stretch = Math.max(t.stretch, Math.min(5, 3 + pu / 5));
    const down = (p.fill || []).filter((m) => m.n === "ダウン" || m.n === "フェザー").reduce((a, m) => a + m.p, 0);
    if (down >= 50) t.warm = 5;
    else if ((p.fill || []).length) t.warm = Math.max(t.warm, 4);
    // 保温を売りにした機能素材・生地(繊維の種類だけでは決まらないもの)は商品名で補正する
    const warmBoost = WARM_NAMES.find(([re]) => re.test(p.n));
    if (warmBoost) t.warm = Math.max(t.warm, warmBoost[1]);
    for (const k in t) t[k] = Math.round(t[k] * 10) / 10;
    return t;
  }
  const WARM_NAMES = [[/超極暖/, 5], [/極暖/, 4.5], [/ヒートテック|裏起毛|ボア|フリース|メルトン|ウォーム/, 4]];
  const warmNote = (p) => { const w = WARM_NAMES.find(([re]) => re.test(p.n)); return w ? `商品名(${p.n.match(w[0])[0]})から保温性を${w[1]}以上にしています。` : ""; };

  // 厚さの目安: 公式の商品名・機能表示・中わたの有無から推定(厚手を優先して判定)
  const THICK_WORDS = ["超極暖", "極暖", "ヘビーウェイト", "ヘビー", "厚手", "ボア", "パデッド", "ダウン", "メルトン", "裏起毛", "ファー", "キルティング", "フリース", "中綿", "ムートン"]; // 「ウォーム」は薄手のTにも付くので厚さには使わない(保温性の補正だけに使う)
  const THIN_WORDS = ["エアリズム", "シアー", "薄手", "メッシュ", "リネン", "シフォン", "クール", "ドライEX", "UVカット", "サッカー", "レース"];
  const LIGHT_DOWN = /ウルトラライトダウン|ライトダウン|ポケッタブル/;
  function thicknessOf(q) {
    const text = [q.n, ...(q.tags || [])].join(" ").replace(/ボタンダウン/g, "");
    if (LIGHT_DOWN.test(text)) return "ふつう"; // 薄く軽いダウンは中わたがあっても厚手にしない
    if ((q.fill || []).length || THICK_WORDS.some((w) => text.includes(w))) return "厚手";
    if (THIN_WORDS.some((w) => text.includes(w))) return "薄手";
    return "ふつう";
  }
  const P = DATA.products.map((p) => {
    const q = { ...p };
    q.t = traitsOf(q);
    q.off = q.bp > q.p ? Math.round((1 - q.p / q.bp) * 100) : 0;
    q.pf = q.pf || [];
    q.deal = q.off > 0 || q.pf.length > 0; // 公式の「期間限定価格」「値下げ」表示がある
    q.fam = [...new Set(q.col.map(famOf).filter(Boolean))];
    q.col.forEach((c) => { const f = famOf(c); if (f && !FAM_HEX[f]) FAM_HEX[f] = MUTED[c[3]] || c[1]; });
    q.matIdx = Object.fromEntries(q.mat.map((m) => [m.n, m.p]));
    q.care = q.care || { machine: q.machine ? "可" : null, hand: !!q.hand, dryer: null, dry: null };
    q.dm = dryerFit(q);
    // 検索対象には解析済みの素材を使う(元の組成文は色ごとの別組成を含み、表示とずれるため入れない)
    q.hay = norm([BRAND_LABEL[q.b], q.n, q.cat, q.g, q.wash, washLabel(q.care), dryerLabel(q.care),
      ...q.mat.map((m) => `${m.n}${m.p} ${m.n}${m.p}% ${m.n}`), q.fam.join(" "), (q.tags || []).join(" ")].join(" "));
    q.rec = (q.r || 0) * Math.log10(1 + q.rc) + (q.deal ? 0.3 : 0);
    q.thick = thicknessOf(q);
    return q;
  });
  const BY_ID = new Map(P.map((p) => [p.id, p]));

  /* ---------- 状態 ---------- */
  const blank = () => ({
    q: "", brands: new Set(), genders: new Set(), cats: new Set(), mats: new Map(), matMode: "and", matMin: 0,
    traits: {}, tags: new Set(), thick: new Set(), pmin:"", pmax: "", care: new Set(), sale: false, colors: new Set(), sizes: new Set(), sort: "rec", preset: "", favOnly: false,
  });
  let S = blank();
  let cmp = [];
  // お気に入り: この端末のブラウザだけに保存(サーバーには送らない)。保存できない環境でも動くようにする
  const FAV_KEY = "sentaku-navi:favs";
  let favs = new Set();
  try { favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch (e) { favs = new Set(); }
  const saveFavs = () => { try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch (e) { /* 保存不可 */ } };
  let openView = ""; // 開いているダイアログ(商品 id か "cmp")。URL に残して共有できるようにする
  let matPick = "in"; // 素材チップを押した時に「含む」か「除く」か(画面上の切り替え)
  let shown = PAGE;
  const openGroups = new Set(["brand", "care", "mat", "trait", "gender"]);

  const PRESETS = [
    { id: "wash", t: "家で洗える", s: "洗濯機OK", patch: { care: ["m"] } },
    { id: "dryer", t: "乾燥機OK", s: "公式の洗濯表示で乾燥機可", patch: { care: ["d"] } },
    { id: "nonet", t: "ネットなしで洗濯機", s: "洗濯ネット不要", patch: { care: ["m0"] } },
    // 「涼しさ」は繊維より生地の作り(エアリズム・メッシュ等)で決まることが多いので、薄手の判定を使い通気性で並べる
    { id: "cool", t: "涼しく着たい", s: "薄手を通気性の高い順", patch: { thick: ["薄手"], sort: "t:breath" } },
    { id: "sweat", t: "汗をよく吸う", s: "吸湿性4以上", patch: { traits: { absorb: 4 } } },
    { id: "warm", t: "冬に暖かい", s: "保温性4以上", patch: { traits: { warm: 4 } } },
    { id: "noiron", t: "アイロンいらず", s: "シワになりにくさ4以上", patch: { traits: { wrinkle: 4 } } },
    { id: "stretch", t: "動きやすい", s: "伸縮性3以上", patch: { traits: { stretch: 3 } } },
    { id: "static", t: "静電気が苦手", s: "静電気の起きにくさ4以上", patch: { traits: { static: 4 } } },
    { id: "cotton", t: "綿100%", s: "本体が綿のみ", patch: { mats: [["綿", "in"]], matMin: 100 } },
    { id: "natural", t: "化学繊維なし", s: "合成繊維5種を除外", patch: { mats: SYNTHETIC.map((m) => [m, "ex"]) } },
    { id: "sale", t: "期間限定・値下げ", s: "公式の価格表示あり", patch: { sale: true } },
  ];

  const SORTS = [
    ["rec", "おすすめ(評価×件数)"], ["price-asc", "価格が安い順"], ["price-desc", "価格が高い順"], ["rating", "評価が高い順"],
    ["reviews", "レビューが多い順"],["mat", "選んだ素材の混率が高い順"],
    ...TRAITS.map((t) => [`t:${t.key}`, `${t.label}が高い順`]), ["name", "名前順"],
  ];

  /* ---------- URL と状態 ---------- */
  function toHash() {
    const u = new URLSearchParams();
    if (S.q) u.set("q", S.q);
    if (S.brands.size) u.set("b", [...S.brands].join(","));
    if (S.genders.size) u.set("g", [...S.genders].join(","));
    if (S.cats.size) u.set("c", [...S.cats].join(","));
    const inc = [...S.mats].filter(([, v]) => v === "in").map(([k]) => k);
    const exc = [...S.mats].filter(([, v]) => v === "ex").map(([k]) => k);
    if (inc.length) u.set("mi", inc.join(","));
    if (exc.length) u.set("mx", exc.join(","));
    if (S.matMode !== "and") u.set("mm", S.matMode);
    if (S.matMin) u.set("mp", S.matMin);
    const tr = Object.entries(S.traits).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`);
    if (tr.length) u.set("t", tr.join(","));
    if (S.tags.size) u.set("tg", [...S.tags].join(","));
    if (S.thick.size) u.set("th", [...S.thick].join(","));
    if (S.pmin) u.set("pmin", S.pmin);
    if (S.pmax) u.set("pmax", S.pmax);
    if (S.care.size) u.set("cr", [...S.care].join(","));
    if (S.sale) u.set("sale", "1");
    if (S.colors.size) u.set("col", [...S.colors].join(","));
    if (S.sizes.size) u.set("sz", [...S.sizes].join(","));
    if (S.sort !== "rec") u.set("s", S.sort);
    if (S.preset) u.set("pr", S.preset);
    if (S.favOnly) u.set("fav", "1");
    if (cmp.length) u.set("cmp", cmp.join(","));
    if (openView && $("dlg").open) u.set("open", openView);
    const h = u.toString();
    history.replaceState(null, "", h ? "#" + h : location.pathname + location.search);
  }
  function fromHash() {
    const u = new URLSearchParams(location.hash.slice(1));
    const s = blank();
    const list = (k) => (u.get(k) ? u.get(k).split(",").filter(Boolean) : []);
    s.q = u.get("q") || "";
    s.brands = new Set(list("b")); s.genders = new Set(list("g")); s.cats = new Set(list("c"));
    for (const m of list("mi")) s.mats.set(m, "in");
    for (const m of list("mx")) s.mats.set(m, "ex");
    s.matMode = u.get("mm") === "or" ? "or" : "and";
    s.matMin = Number(u.get("mp")) || 0;
    for (const kv of list("t")) { const [k, v] = kv.split(":"); if (TRAITS.some((t) => t.key === k)) s.traits[k] = Number(v) || 0; }
    s.tags = new Set(list("tg"));
    s.thick = new Set(list("th"));
    s.pmin = u.get("pmin") || ""; s.pmax = u.get("pmax") || "";
    s.care = new Set(list("cr").filter((k) => CARE_FN[k]));
    if (u.get("w") === "1") s.care.add("m"); // 旧URL(洗濯機可)との互換
    s.sale = u.get("sale") === "1";
    s.colors = new Set(list("col")); s.sizes = new Set(list("sz"));
    s.sort = SORTS.some(([k]) => k === u.get("s")) ? u.get("s") : "rec";
    s.preset = u.get("pr") || "";
    s.favOnly = u.get("fav") === "1";
    S = s;
    cmp = list("cmp").filter((id) => BY_ID.has(id)).slice(0, MAX_CMP);
  }

  /* ---------- 絞り込み ---------- */
  function matches(p, skip) {
    if (S.q) {
      for (const tok of norm(S.q).split(/\s+/).filter(Boolean)) if (!p.hay.includes(tok)) return false;
    }
    if (S.favOnly && !favs.has(p.id)) return false;
    if (skip !== "brand" && S.brands.size && !S.brands.has(p.b)) return false;
    if (skip !== "gender" && S.genders.size && !S.genders.has(p.g)) return false;
    if (skip !== "cat" && S.cats.size && !S.cats.has(p.cat)) return false;
    if (skip !== "mat" && S.mats.size) {
      const inc = [], exc = [];
      for (const [m, v] of S.mats) (v === "in" ? inc : exc).push(m);
      for (const m of exc) if (p.matIdx[m]) return false;
      if (inc.length) {
        const ok = (m) => (p.matIdx[m] || 0) >= Math.max(1, S.matMin);
        if (S.matMode === "and" ? !inc.every(ok) : !inc.some(ok)) return false;
      }
    }
    if (skip !== "trait") {
      for (const [k, v] of Object.entries(S.traits)) if (v && (!p.t || p.t[k] < v)) return false;
    }
    if (skip !== "tag" && S.tags.size && !(p.tags || []).some((t) => S.tags.has(t))) return false;
    if (skip !== "price") {
      if (S.pmin && p.p < Number(S.pmin)) return false;
      if (S.pmax && p.p > Number(S.pmax)) return false;
    }
    if (skip !== "thick" && S.thick.size && !S.thick.has(p.thick)) return false;
    if (skip !== "care") for (const k of S.care) if (!CARE_FN[k](p)) return false;
    if (skip !== "sale" && S.sale && !p.deal) return false;
    if (skip !== "color" && S.colors.size && !p.fam.some((f) => S.colors.has(f))) return false;
    if (skip !== "size" && S.sizes.size && !p.sz.some((z) => S.sizes.has(z))) return false;
    return true;
  }

  function sorted(list) {
    const inc = [...S.mats].filter(([, v]) => v === "in").map(([k]) => k);
    const key = {
      rec: (p) => -p.rec, "price-asc": (p) => p.p, "price-desc": (p) => -p.p, rating: (p) => -((p.r || 0) * 1e7 + Math.min(p.rc, 9999999)),
      reviews: (p) => -p.rc, off: (p) => -p.off, name: null,
      mat: (p) => -inc.reduce((a, m) => a + (p.matIdx[m] || 0), 0),
    }[S.sort];
    if (S.sort === "name") return list.sort((a, b) => a.n.localeCompare(b.n, "ja"));
    if (S.sort.startsWith("t:")) {
      const k = S.sort.slice(2);
      return list.sort((a, b) => (b.t ? b.t[k] : -1) - (a.t ? a.t[k] : -1) || b.rec - a.rec);
    }
    return list.sort((a, b) => key(a) - key(b) || b.rec - a.rec);
  }

  const countBy = (skip, fn) => {
    const m = new Map();
    for (const p of P) if (matches(p, skip)) for (const k of [].concat(fn(p))) m.set(k, (m.get(k) || 0) + 1);
    return m;
  };

  /* ---------- 描画: 絞り込みパネル ---------- */
  const $ = (id) => document.getElementById(id);

  function group(id, title, selCount, body, hint = "") {
    return `<details class="fgroup" data-g="${id}" ${openGroups.has(id) ? "open" : ""}>
      <summary>${title}${selCount ? `<span class="sel-count">${selCount}件選択</span>` : ""}</summary>
      <div class="fbody">${hint ? `<p class="fhint">${hint}</p>` : ""}${body}</div></details>`;
  }
  function chipList(kind, entries, selected, labeler = (k) => k, extra = () => "") {
    return `<div class="chips">${entries.map(([k, n]) => {
      const on = selected.has(k);
      return `<button class="chip" data-k="${kind}" data-v="${esc(k)}" aria-pressed="${on}" ${!n && !on ? "disabled" : ""}>${extra(k)}${esc(labeler(k))}<span class="n">${n}</span></button>`;
    }).join("")}</div>`;
  }

  function renderFilters() {
    const html = [];
    const bc = countBy("brand", (p) => p.b);
    const allBrands = ["uniqlo", "gu", "muji"].filter((b) => DATA.brands[b] || bc.has(b));
    html.push(group("brand", "ブランド", S.brands.size, chipList("brand", allBrands.map((b) => [b, bc.get(b) || 0]), S.brands, (b) => BRAND_LABEL[b] || b)));

    // 洗濯・乾燥: 公式の洗濯表示と、素材から見た乾燥機の目安
    const crc = countBy("care", (p) => CARE_OPTS.filter(([, , f]) => f(p)).map(([k]) => k));
    const careChips = (keys) => chipList("care", keys.map((k) => [k, crc.get(k) || 0]), S.care, (k) => CARE_NAME[k]);
    html.push(group("care", "洗濯・乾燥", S.care.size,
      `<p class="fsub">公式の洗濯表示</p>${careChips(["m", "m0", "h", "d"])}
       <p class="fsub">素材から見た乾燥機の目安</p>${careChips(["dm", "dm1"])}`,
      "複数選ぶと「すべて満たす」。乾燥機の可否は公式表示を優先してください(素材の目安は一般的な傾向)。"));

    const gc = countBy("gender", (p) => p.g);
    const gs = ["メンズ", "ウィメンズ", "ユニセックス", "キッズ", "ベビー"].filter((g) => P.some((p) => p.g === g));
    html.push(group("gender", "対象", S.genders.size, chipList("gender", gs.map((g) => [g, gc.get(g) || 0]), S.genders)));

    const cc = countBy("cat", (p) => p.cat);
    const cats = [...new Set(P.map((p) => p.cat))];
    html.push(group("cat", "カテゴリ", S.cats.size, chipList("cat", cats.map((c) => [c, cc.get(c) || 0]), S.cats)));

    // 素材: 上の切り替えで「含む素材を選ぶ」「除く素材を選ぶ」を決めてからチップを押す
    const mc = countBy("mat", (p) => p.mat.map((m) => m.n));
    const allMats = Object.keys(MATS).filter((m) => P.some((p) => p.matIdx[m])).concat(P.some((p) => p.matIdx["その他"]) ? ["その他"] : []);
    allMats.sort((a, b) => (mc.get(b) || 0) - (mc.get(a) || 0));
    const pickSeg = `<div class="mat-pick seg" role="group" aria-label="素材の選び方">
        <button data-k="matPick" data-v="in" aria-pressed="${matPick === "in"}">＋ 含む素材を選ぶ</button>
        <button data-k="matPick" data-v="ex" aria-pressed="${matPick === "ex"}" class="ex-mode">− 除く素材を選ぶ</button></div>`;
    // 素材ごとに「乾燥機の向き不向き」と「得意な特性」を横に並べて、選ぶ前に特徴が分かるようにする
    const DRY_MARK = ["×", "△", "○"];
    const matFeat = (m) => {
      const d = DRY[m];
      const dry = d ? `<span class="mf-dry dm${d.lv}" title="${esc(d.why)}">乾燥機${DRY_MARK[d.lv]}${DRY_LABEL[d.lv]}</span>` : "";
      const t = MATS[m] && MATS[m].t;
      const good = t ? TRAITS.filter((tr) => t[tr.key] >= 4).sort((a, b) => t[b.key] - t[a.key]).slice(0, 3)
        .map((tr) => `<span class="mf-good" title="${esc(tr.label)} ${t[tr.key]}">${esc(tr.short || tr.label)}</span>`).join("") : "";
      return dry + good;
    };
    const matChips = `<div class="matlist">${allMats.map((m) => {
      const st = S.mats.get(m);
      const n = mc.get(m) || 0;
      return `<button class="matrow ${st === "in" ? "on" : st === "ex" ? "ex" : ""}" data-k="mat" data-v="${esc(m)}" aria-pressed="${!!st}" aria-label="${esc(m)} ${st === "in" ? "含む" : st === "ex" ? "除く" : "未選択"}"
        ${!n && !st ? "disabled" : ""}><span class="mr-name">${st === "ex" ? "<b class=\"exb\">除く</b>" : `<span class="sw" style="background:${MAT_COLOR[m] || "#ccc"}"></span>`}${esc(m)}<span class="n">${n}</span></span>
        <span class="mr-feat">${matFeat(m)}</span></button>`;
    }).join("")}</div>`;
    const incN = [...S.mats.values()].filter((v) => v === "in").length;
    const matTools = !incN ? "" : `<div class="mat-mode">
        <span>含む素材を複数選んだ時:</span>
        <span class="seg" role="group" aria-label="複数素材の条件">
          <button data-k="matMode" data-v="and" aria-pressed="${S.matMode === "and"}">すべて含む</button>
          <button data-k="matMode" data-v="or" aria-pressed="${S.matMode === "or"}">どれか含む</button>
        </span></div>
      <label class="mat-pct"><span>含む素材の混率</span>
        <select data-k="matMin">
          ${[[0, "少しでも含む"], [30, "30%以上"], [50, "50%以上"], [80, "80%以上"], [100, "100%(単一素材)"]]
            .map(([v, l]) => `<option value="${v}" ${S.matMin === v ? "selected" : ""}>${l}</option>`).join("")}
        </select></label>`;
    html.push(group("mat", "素材", S.mats.size, pickSeg + matChips + matTools, "本体の素材で判定します。もう一度押すと解除。"));

    // 特性
    const traitRows = TRAITS.map((t) => {
      const v = S.traits[t.key] || 0;
      return `<div class="trait-row"><span title="${esc(t.hint)}">${t.label}</span>
        <span class="seg" role="group" aria-label="${t.label}">
          ${[[0, "指定なし"], [3, "3以上"], [4, "4以上"]].map(([lv, l]) => `<button data-k="trait" data-t="${t.key}" data-v="${lv}" aria-pressed="${v === lv}">${l}</button>`).join("")}
        </span></div>`;
    }).join("");
    html.push(group("trait", "素材の特性", Object.values(S.traits).filter(Boolean).length, traitRows,
      "素材の混率から計算した目安(5段階)。生地や加工で実際とは変わります。"));

    const tgc = countBy("tag", (p) => p.tags || []);
    const allTags = [...new Map(P.flatMap((p) => (p.tags || []).map((t) => [t, 1]))).keys()]
      .filter((t) => P.filter((p) => (p.tags || []).includes(t)).length >= 3 || S.tags.has(t))
      .sort((a, b) => (tgc.get(b) || 0) - (tgc.get(a) || 0));
    if (allTags.length) html.push(group("tag", "機能・シリーズ", S.tags.size, chipList("tag", allTags.map((t) => [t, tgc.get(t) || 0]), S.tags),
      "公式サイトの機能表示(エアリズム・ヒートテックなど)。複数選ぶと「どれか」"));

    const salec = countBy("sale", (p) => (p.deal ? "s" : []));
    html.push(group("price", "価格", (S.pmin || S.pmax ? 1 : 0) + (S.sale ? 1 : 0), `<div class="price-row">
      <input type="number" inputmode="numeric" min="0" step="100" placeholder="下限" value="${esc(S.pmin)}" data-k="pmin" aria-label="下限価格"> 〜
      <input type="number" inputmode="numeric" min="0" step="100" placeholder="上限" value="${esc(S.pmax)}" data-k="pmax" aria-label="上限価格"></div>
      <div class="chips" style="margin-top:8px">${[[0, 1000], [0, 2000], [0, 3000], [3000, 6000], [6000, ""]].map(([a, b]) =>
        `<button class="chip" data-k="prange" data-v="${a}-${b}" aria-pressed="${String(S.pmin) === String(a || "") && String(S.pmax) === String(b)}">${b ? (a ? `${yen(a)}〜${yen(b)}` : `${yen(b)}以下`) : `${yen(a)}以上`}</button>`).join("")}</div>
      <label class="check" style="margin-top:8px"><input type="checkbox" data-k="sale" ${S.sale ? "checked" : ""}> 期間限定価格・値下げ <span class="note">(${salec.get("s") || 0})</span></label>`));

    const thc = countBy("thick", (p) => p.thick);
    html.push(group("thick", "厚さの目安", S.thick.size, chipList("thick", ["薄手", "ふつう", "厚手"].map((t) => [t, thc.get(t) || 0]), S.thick),
      "商品名・機能・中わたから推定(例: エアリズム→薄手、極暖・ダウン→厚手)"));


    const colc = countBy("color", (p) => p.fam);
    const fams = Object.values(COLOR_FAMILY).filter((f) => FAM_HEX[f]);
    html.push(group("color", "色", S.colors.size, chipList("color", fams.map((f) => [f, colc.get(f) || 0]), S.colors, (f) => f,
      (f) => `<span class="sw" style="background:${FAM_HEX[f]}"></span>`)));

    const szc = countBy("size", (p) => p.sz);
    const sizes = [...szc.keys()].concat([...S.sizes].filter((s) => !szc.has(s)));
    sizes.sort((a, b) => {
      const ia = SIZE_ORDER.indexOf(a), ib = SIZE_ORDER.indexOf(b);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return (parseFloat(a) || 999) - (parseFloat(b) || 999) || a.localeCompare(b);
    });
    html.push(group("size", "サイズ", S.sizes.size, chipList("size", sizes.map((s) => [s, szc.get(s) || 0]), S.sizes)));

    $("filter-body").innerHTML = html.join("");
  }

  /* ---------- 描画: 結果 ---------- */
  function matBar(p) {
    return `<div class="matbar" aria-hidden="true">${p.mat.map((m) => `<i style="width:${m.p}%;background:${MAT_COLOR[m.n] || "#ccc"}"></i>`).join("")}</div>`;
  }
  function matText(p) {
    if (!p.mat.length) return `<span class="matlabel">素材情報なし</span>`;
    return `<span class="matlabel">${p.mat.slice(0, 3).map((m) => `<b>${esc(m.n)}</b>${m.p}%`).join(" / ")}${p.mat.length > 3 ? " ほか" : ""}</span>`;
  }
  function topTraits(p) {
    if (!p.t) return "";
    const active = Object.keys(S.traits).filter((k) => S.traits[k]);
    const keys = TRAITS.map((t) => t.key).sort((a, b) => (active.includes(b) - active.includes(a)) || p.t[b] - p.t[a]).slice(0, 3);
    return `<div class="tags">${keys.filter((k) => p.t[k] >= 3.5 || active.includes(k)).map((k) =>
      `<span class="tag ${p.t[k] >= 4 ? "good" : ""}">${TRAITS.find((t) => t.key === k).label} ${p.t[k].toFixed(1)}</span>`).join("")}</div>`;
  }
  // 商品カードの洗濯・乾燥バッジ(公式表示)。乾燥機は素材の目安も小さく添える
  function careBadges(p) {
    const c = p.care;
    const wcls = c.machine === "可" || c.machine === "ネット" ? "ok" : c.machine === "不可" ? "ng" : "na";
    const dcls = c.dryer === "可" ? "ok" : c.dryer === "不可" ? "ng" : "na";
    const dm = p.dm ? `<span class="cb dm dm${p.dm.lv}" title="素材から見た目安: ${esc(p.dm.by.join("・"))}">素材: 乾燥機${DRY_LABEL[p.dm.lv]}</span>` : "";
    return `<div class="careb"><span class="cb ${wcls}">${washLabel(c)}</span><span class="cb ${dcls}">${dryerLabel(c)}</span>${dm}</div>`;
  }
  function careDetail(p) {
    const c = p.care;
    const dmTxt = p.dm ? `<b>${DRY_LABEL[p.dm.lv]}</b>(${p.dm.by.map((m) => `${esc(m)}: ${esc(DRY[m].why)}`).join(" / ")})` : "判定できません(素材情報が不足)";
    const conflict = p.dm && c.dryer === "可" && p.dm.lv < 2 ? `<br><span class="note">※公式表示では乾燥機OKです。生地の加工などで素材の一般的な傾向より強くなっていると考えられます。公式表示を優先してください。</span>` : "";
    return `${careBadges(p)}
      <span class="note">公式の表示: ${esc(p.wash || "情報なし")}</span><br>
      <span class="note">素材から見た乾燥機の目安: ${dmTxt}</span>${conflict}`;
  }
  function placeholder(p) {
    const cols = p.col.slice(0, 8).map(colorHex);
    const bg = cols.length ? `linear-gradient(90deg, ${cols.map((c, i) => `${c} ${(i / cols.length) * 100}% ${((i + 1) / cols.length) * 100}%`).join(", ")})` : "var(--surface-2)";
    return `<span class="ph" title="画像は表示しない設定です"><span class="ph-cols" style="background:${bg}"></span></span>`;
  }
  function img(p, cls = "", src = p.img) {
    if (!CONFIG.images) return placeholder(p);
    return src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="${cls}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'noimg',textContent:'画像なし'}))">`
      : `<span class="noimg">画像なし</span>`;
  }
  function priceHtml(p) {
    return `<span class="price ${p.deal ? "sale" : ""}">${yen(p.p)}${p.off ? `<del>${yen(p.bp)}</del>` : ""}${p.pf.length ? `<span class="deal">${esc(p.pf[0])}</span>` : ""}</span>`;
  }
  function card(p) {
    const inCmp = cmp.includes(p.id);
    return `<article class="card">
      <button class="card-img" data-open="${p.id}" aria-label="${esc(p.n)}の詳細">${img(p)}<span class="brand-tag ${p.b}">${BRAND_LABEL[p.b]}</span></button>
      <div class="card-body">
        <button class="card-name" data-open="${p.id}">${esc(p.n)}</button>
        <div class="card-meta">${esc(p.g)}・${esc(p.cat)}${p.thick !== "ふつう" ? `・<span class="thick ${p.thick === "厚手" ? "th-k" : "th-n"}">${p.thick}</span>` : ""}${p.v > 1 ? `・柄/色違い${p.v}種` : ""}</div>
        ${priceHtml(p)}
        ${matBar(p)}${matText(p)}
        ${careBadges(p)}
        ${topTraits(p)}
        <div class="card-foot">
          <span class="rating">${p.r ? `★${p.r.toFixed(1)}(${p.rc.toLocaleString()})` : ""}</span>
          <button class="fav-btn" data-fav="${p.id}" aria-pressed="${favs.has(p.id)}" aria-label="お気に入り${favs.has(p.id) ? "から外す" : "に追加"}">${favs.has(p.id) ? "♥" : "♡"}</button>
          <button class="cmp-btn" data-cmp="${p.id}" aria-pressed="${inCmp}">${inCmp ? "比較中" : "＋比較"}</button>
        </div>
      </div></article>`;
  }

  let lastList = [];
  function render() {
    const list = sorted(P.filter((p) => matches(p)));
    lastList = list;
    $("count").textContent = list.length.toLocaleString();
    $("count-foot").textContent = list.length.toLocaleString();
    $("grid").innerHTML = list.slice(0, shown).map(card).join("");
    $("more").hidden = list.length <= shown;
    $("more").textContent = `もっと見る(残り${list.length - shown}件)`;
    $("empty").hidden = list.length > 0;
    renderBrandSum(list);
    $("fav-only").setAttribute("aria-pressed", String(S.favOnly));
    $("fav-count").hidden = !favs.size;
    $("fav-count").textContent = favs.size;
    renderFilters();
    renderActive();
    renderPresets();
    renderTray();
    $("sort").value = S.sort;
    toHash();
  }

  // ブランド別の件数と価格帯(ブランドをまたいで比べる時の手がかり)
  function renderBrandSum(list) {
    const by = {};
    for (const p of list) {
      const x = by[p.b] || (by[p.b] = { n: 0, min: Infinity, max: 0, cheapest: null });
      x.n++;
      if (p.p < x.min) { x.min = p.p; x.cheapest = p; }
      x.max = Math.max(x.max, p.p);
    }
    const keys = Object.keys(by);
    $("brandsum").innerHTML = keys.length < 2 ? "" : keys.map((b) => {
      const x = by[b];
      return `<div class="bs"><b>${BRAND_LABEL[b]}</b> ${x.n}件 <span class="note">${yen(x.min)}〜${yen(x.max)}</span>
        <button class="link-btn" data-open="${x.cheapest.id}" title="${esc(x.cheapest.n)}">最安を見る</button></div>`;
    }).join("");
  }

  // 条件を1つ外す(選択中の条件チップ・0件時の提案で共通に使う)
  function removeCond(s, act) {
    const [k, v] = act.split(/:(.*)/s);
    if (k === "q") s.q = "";
    else if (k === "brand") s.brands.delete(v);
    else if (k === "gender") s.genders.delete(v);
    else if (k === "cat") s.cats.delete(v);
    else if (k === "mat") s.mats.delete(v);
    else if (k === "trait") delete s.traits[v];
    else if (k === "tag") s.tags.delete(v);
    else if (k === "thick") s.thick.delete(v);
    else if (k === "price") { s.pmin = ""; s.pmax = ""; }
    else if (k === "care") s.care.delete(v);
    else if (k === "sale") s.sale = false;
    else if (k === "color") s.colors.delete(v);
    else if (k === "size") s.sizes.delete(v);
    else if (k === "fav") s.favOnly = false;
  }
  const cloneState = (s) => ({ ...s, brands: new Set(s.brands), genders: new Set(s.genders), cats: new Set(s.cats), mats: new Map(s.mats),
    traits: { ...s.traits }, care: new Set(s.care), tags: new Set(s.tags), thick: new Set(s.thick), colors: new Set(s.colors), sizes: new Set(s.sizes) });

  // 0件の時: どの条件を外すと何件になるかを出す
  function renderEmpty(actives) {
    const saved = S;
    const tips = actives.map(([label, act]) => {
      S = cloneState(saved);
      removeCond(S, act);
      const n = P.filter((p) => matches(p)).length;
      return [label, act, n];
    }).filter((x) => x[2] > 0).sort((a, b) => b[2] - a[2]).slice(0, 4);
    S = saved;
    if (S.favOnly && !favs.size) {
      $("empty").innerHTML = `<p>お気に入りはまだありません。</p><p class="note">商品の ♡ を押すと、この端末のブラウザに保存されます。</p>
        <div class="chips" style="justify-content:center"><button class="chip" data-rm="fav">すべての商品を見る</button></div>`;
      return;
    }
    $("empty").innerHTML = `<p>条件に合う商品がありません。</p>${tips.length ? `<p class="note">次の条件を外すと見つかります:</p>
      <div class="chips" style="justify-content:center">${tips.map(([label, act, n]) => `<button class="chip" data-rm="${esc(act)}">${label.startsWith("「") ? esc(label) : `「${esc(label)}」`}を外す → ${n}件</button>`).join("")}</div>` : ""}`;
  }

  function renderActive() {
    const a = [];
    const actives = [];
    const add = (label, act, cls = "") => { actives.push([label, act]); a.push(`<button class="chip ${cls}" data-rm="${esc(act)}">${esc(label)} ×</button>`); };
    if (S.q) add(`「${S.q}」`, "q");
    S.brands.forEach((b) => add(BRAND_LABEL[b], `brand:${b}`));
    S.genders.forEach((g) => add(g, `gender:${g}`));
    S.cats.forEach((c) => add(c, `cat:${c}`));
    S.mats.forEach((v, m) => add(`${m}${v === "in" ? (S.matMin === 100 ? "100%" : S.matMin ? `${S.matMin}%以上` : "を含む") : "を除く"}`, `mat:${m}`, v === "ex" ? "ex" : ""));
    Object.entries(S.traits).forEach(([k, v]) => v && add(`${TRAITS.find((t) => t.key === k).label}${v}以上`, `trait:${k}`));
    S.tags.forEach((t) => add(t, `tag:${t}`));
    S.thick.forEach((t) => add(t, `thick:${t}`));
    if (S.pmin || S.pmax) add(`${S.pmin ? yen(S.pmin) : ""}〜${S.pmax ? yen(S.pmax) : ""}`, "price");
    S.care.forEach((k) => add(CARE_NAME[k], `care:${k}`));
    if (S.sale) add("期間限定・値下げ", "sale");
    S.colors.forEach((c) => add(c, `color:${c}`));
    S.sizes.forEach((s) => add(`サイズ ${s}`, `size:${s}`));
    if (S.favOnly) add("♥ お気に入りのみ", "fav");
    $("active").innerHTML = a.join("") + (a.length ? `<button class="link-btn share-link" id="copy-search" title="この条件のURLをコピー">この条件をリンクで共有</button>` : "");
    const n = a.length - (S.q ? 1 : 0) - (S.favOnly ? 1 : 0);
    $("filter-badge").hidden = !n;
    $("filter-badge").textContent = n;
    if (!$("empty").hidden) renderEmpty(actives);
  }

  function renderPresets() {
    $("presets").innerHTML = PRESETS.map((p) => `<button class="preset" data-preset="${p.id}" aria-pressed="${S.preset === p.id}"><b>${p.t}</b><span>${p.s}</span></button>`).join("");
  }

  function renderTray() {
    const tray = $("tray");
    tray.hidden = !cmp.length;
    document.body.classList.toggle("has-tray", cmp.length > 0);
    $("tray-items").innerHTML = cmp.map((id) => {
      const p = BY_ID.get(id);
      return `<div class="tray-item" title="${esc(p.n)}">${img(p)}<button data-uncmp="${id}" aria-label="${esc(p.n)}を比較から外す">×</button></div>`;
    }).join("") + Array.from({ length: MAX_CMP - cmp.length }, () => `<span class="tray-slot"></span>`).join("");
    $("tray-open").textContent = `比較する(${cmp.length})`;
    $("tray-open").disabled = cmp.length < 2;
  }

  /* ---------- ダイアログ ---------- */
  function openDlg(title, html) {
    $("dlg-title").textContent = title;
    $("dlg-body").innerHTML = html;
    const d = $("dlg");
    if (!d.open) d.showModal();
    $("dlg-body").scrollTop = 0;
    d.scrollTop = 0;
  }
  function traitBars(t, showVal = true) {
    if (!t) return `<p class="note">素材の特性を計算できません(素材情報が不足)。</p>`;
    return `<div class="traits">${TRAITS.map((tr) => `<div class="trait"><span title="${esc(tr.hint)}">${tr.label}</span>
      <span class="tbar"><i style="width:${(t[tr.key] / 5) * 100}%"></i></span>${showVal ? `<span class="tval">${t[tr.key].toFixed(1)}</span>` : ""}</div>`).join("")}</div>`;
  }
  function similar(p, n = 6) {
    const vec = (q) => q.matIdx;
    const sim = (a, b) => {
      const keys = new Set([...Object.keys(vec(a)), ...Object.keys(vec(b))]);
      let dot = 0, na = 0, nb = 0;
      keys.forEach((k) => { const x = vec(a)[k] || 0, y = vec(b)[k] || 0; dot += x * y; na += x * x; nb += y * y; });
      return na && nb ? dot / Math.sqrt(na * nb) : 0;
    };
    // 袖丈などの形の言葉が一致するほど近いとみなす
    const SHAPE = ["半袖", "長袖", "5分袖", "7分袖", "8分袖", "ノースリーブ", "タンクトップ", "クルーネック", "Vネック", "タートルネック", "モックネック",
      "ワイド", "スリム", "ストレート", "バギー", "オーバーサイズ", "ロング", "ショート", "ミニ", "ミディ", "フルジップ", "プルオーバー"];
    const shapes = (q) => new Set(SHAPE.filter((w) => q.n.includes(w)));
    const ps = shapes(p);
    const shapeScore = (q) => { const qs = shapes(q); let s = 0; ps.forEach((w) => { if (qs.has(w)) s += 0.4; }); qs.forEach((w) => { if (!ps.has(w)) s -= 0.15; }); return s; };
    const kids = (q) => q.g === "キッズ" || q.g === "ベビー";
    const genderOk = (q) => q.g === p.g || q.g === "ユニセックス" || p.g === "ユニセックス";
    const score = (q) => sim(p, q) * 2 + (q.cat === p.cat ? 2 : 0) + (genderOk(q) ? 0.6 : 0) + shapeScore(q) + (q.thick === p.thick ? 0.3 : 0) - Math.abs(Math.log(q.p / p.p)) * 0.8;
    const others = P.filter((q) => q.b !== p.b && q.id !== p.id && kids(q) === kids(p));
    return others.map((q) => [score(q), q]).sort((a, b) => b[0] - a[0]).slice(0, n).map((x) => x[1]);
  }
  function openDetail(id) {
    const p = BY_ID.get(id);
    if (!p) return;
    openView = id;
    queueMicrotask(toHash);
    const parts = p.parts && p.parts.length ? p.parts.map((s) => `${s.label ? esc(s.label) + ": " : ""}${s.items.map((m) => `${esc(m.n)} ${m.p}%`).join(", ")}`).join("<br>") : esc(p.comp || "情報なし");
    const seenCol = new Set();
    const cols = p.col.filter((c) => { const k = jpColor(c[0]); if (seenCol.has(k)) return false; seenCol.add(k); return true; });
    const sw = cols.map((c) => `<button class="swatch" style="background:${esc(colorHex(c))}" title="${esc(jpColor(c[0]))}" aria-label="${esc(jpColor(c[0]))}" data-swatch="${esc(c[2] || "")}"></button>`).join("");
    const known = p.mat.filter((m) => MATS[m.n] && MATS[m.n].t);
    const why = p.t ? `<details class="why"><summary>この数値の計算内訳</summary>
      <div style="overflow-x:auto"><table class="why-t"><thead><tr><th>素材</th>${TRAITS.map((t) => `<th title="${esc(t.label)}">${esc(t.label.slice(0, 2))}</th>`).join("")}</tr></thead>
      <tbody>${known.map((m) => `<tr><th>${esc(m.n)} ${m.p}%</th>${TRAITS.map((t) => `<td>${MATS[m.n].t[t.key]}</td>`).join("")}</tr>`).join("")}
      <tr class="sum"><th>この商品</th>${TRAITS.map((t) => `<td>${p.t[t.key].toFixed(1)}</td>`).join("")}</tr></tbody></table></div>
      <p class="note">素材ごとの値(5段階)を混率で平均。${(p.mat.find((m) => m.n === "ポリウレタン") || {}).p >= 2 ? "ポリウレタン入りのため伸縮性を上げています。" : ""}${(p.fill || []).length ? `中わた(${p.fill.map((m) => esc(m.n)).join("・")})があるため保温性を上げています。` : ""}${esc(warmNote(p))}生地の厚さや編み方は含みません。</p></details>` : "";
    const sims = similar(p);
    const inCmp = cmp.includes(p.id);
    openDlg(p.n, `<div class="detail">
      <div><div class="detail-img" id="detail-img">${img(p)}</div>
        <div class="swatches" data-pid="${p.id}">${sw}</div><p class="note">色: ${cols.map((c) => esc(jpColor(c[0]))).join(" / ") || "—"}</p></div>
      <div>
        <div>${priceHtml(p)} <span class="note">取得時点の価格</span></div>
        <dl class="kv">
          <dt>ブランド</dt><dd>${BRAND_LABEL[p.b]}</dd>
          <dt>対象</dt><dd>${esc(p.g)}</dd>
          <dt>カテゴリ</dt><dd>${esc(p.cat)}</dd>
          <dt>素材</dt><dd>${parts}${p.alt ? `<br><span class="note">※色や生産時期で組成が異なります(代表的な1つを表示)。公式で確認してください</span>` : ""}</dd>
          <dt>厚さの目安</dt><dd>${p.thick} <span class="note">(商品名などから推定)</span></dd>
          ${(p.tags || []).length ? `<dt>機能</dt><dd>${p.tags.map(esc).join(" / ")}</dd>` : ""}
          <dt>洗濯・乾燥</dt><dd>${careDetail(p)}</dd>
          <dt>サイズ</dt><dd>${esc(p.sz.join(" / ") || "—")}</dd>
          <dt>評価</dt><dd>${p.r ? `★${p.r.toFixed(1)}(${p.rc.toLocaleString()}件)` : "—"}</dd>
        </dl>
        ${matBar(p)}
        <h3>素材の特性(目安)</h3>${traitBars(p.t)}
        <p class="note">本体素材の混率で重み付けした一般的な傾向です。</p>${why}
        <p style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
          <a class="primary-btn" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">公式サイトで見る</a>
          <button class="ghost-btn" data-cmp="${p.id}" aria-pressed="${inCmp}">${inCmp ? "比較から外す" : "比較に追加"}</button>
          <button class="ghost-btn fav-btn" data-fav="${p.id}" aria-pressed="${favs.has(p.id)}" aria-label="お気に入り${favs.has(p.id) ? "から外す" : "に追加"}">${favs.has(p.id) ? "♥" : "♡"}</button>
        </p>
      </div></div>
      <h3>他ブランドの似た商品</h3>
      <p class="note">素材の構成・カテゴリ・価格が近いものを表示</p>
      <div class="similar">${sims.map((q) => `<button class="mini" data-open="${q.id}">${img(q)}<div><b>${BRAND_LABEL[q.b]}</b> ${esc(q.n)}<br>${yen(q.p)}・${q.mat.slice(0, 2).map((m) => `${esc(m.n)}${m.p}%`).join(" ")}</div></button>`).join("")}</div>`);
  }

  function openCompare(onlyDiff = false) {
    const items = cmp.map((id) => BY_ID.get(id)).filter(Boolean);
    if (items.length < 2) return;
    openView = "cmp";
    queueMicrotask(toHash);
    const rows = [];
    const row = (label, cells, opts = {}) => {
      const texts = cells.map((c) => String(c.text ?? c));
      const diff = new Set(texts).size > 1;
      if (onlyDiff && !diff && !opts.always) return;
      let best = -1;
      if (opts.best && diff) {
        const vals = cells.map((c) => c.v);
        const target = opts.best === "min" ? Math.min(...vals.filter((v) => v != null)) : Math.max(...vals.filter((v) => v != null));
        best = vals.indexOf(target);
      }
      rows.push(`<tr class="${diff ? "diff" : ""}"><th scope="row">${label}</th>${cells.map((c, i) => `<td class="${i === best ? "best" : ""}">${c.html ?? esc(c.text ?? c)}</td>`).join("")}</tr>`);
    };
    row("価格", items.map((p) => ({ v: p.p, text: yen(p.p), html: priceHtml(p) })), { best: "min", always: true });
    row("本体素材", items.map((p) => ({ text: p.mat.map((m) => `${m.n}${m.p}%`).join(" "), html: matBar(p) + matText(p) })), { always: true });
    for (const t of TRAITS) {
      row(t.label, items.map((p) => (p.t ? { v: p.t[t.key], text: p.t[t.key].toFixed(1), html: `<span class="tbar" style="display:block;margin:6px 0 2px"><i style="width:${p.t[t.key] * 20}%"></i></span>${p.t[t.key].toFixed(1)}` } : { v: null, text: "—" })), { best: "max" });
    }
    row("厚さの目安", items.map((p) => p.thick));
    row("機能", items.map((p) => (p.tags || []).join(" / ") || "—"));
    row("洗濯機", items.map((p) => ({ v: p.care.machine === "可" ? 2 : p.care.machine === "ネット" ? 1 : 0, text: washLabel(p.care) })), { best: "max", always: true });
    row("乾燥機(公式)", items.map((p) => ({ v: p.care.dryer === "可" ? 1 : 0, text: dryerLabel(p.care) })), { best: "max", always: true });
    row("乾燥機(素材の目安)", items.map((p) => ({ v: p.dm ? p.dm.lv : null, text: p.dm ? `${DRY_LABEL[p.dm.lv]}(${p.dm.by.join("・")})` : "—" })), { best: "max" });
    row("洗濯表示(全文)", items.map((p) => p.wash || "—"));
    row("対象", items.map((p) => p.g));
    row("色数", items.map((p) => ({ v: p.col.length, text: `${p.col.length}色` })));
    row("サイズ", items.map((p) => p.sz.join(" / ") || "—"));
    row("評価", items.map((p) => ({ v: p.r ?? null, text: p.r ? `★${p.r.toFixed(1)}(${p.rc.toLocaleString()})` : "—" })), { best: "max" });
    const head = `<tr><th></th>${items.map((p) => `<th><button class="mini" data-open="${p.id}" style="border:0;padding:0">${img(p)}</button>
      <div style="margin-top:6px"><b>${BRAND_LABEL[p.b]}</b><br>${esc(p.n)}</div>
      <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap"><a class="cmp-btn" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">公式で見る</a>
      <button class="link-btn" data-uncmp="${p.id}" data-recmp="1">外す</button></div></th>`).join("")}</tr>`;
    openDlg(`比較(${items.length}件)`, `<div class="cmp-tools">
      <label class="check"><input type="checkbox" id="only-diff" ${onlyDiff ? "checked" : ""}> 違いのある行だけ表示</label>
      <span class="note">◎ = その行で最も良い値 / ● = 商品ごとに違う項目</span>
      <button class="link-btn" id="copy-link">この比較のリンクをコピー</button></div>
      <div class="cmp-wrap"><table class="cmp"><thead>${head}</thead><tbody>${rows.join("")}</tbody></table></div>`);
  }

  function openGuide() {
    openView = "guide";
    queueMicrotask(toHash);
    const cnt =(m) => P.filter((p) => p.matIdx[m]).length;
    const list = Object.entries(MATS).filter(([, v]) => v.t).sort((a, b) => cnt(b[0]) - cnt(a[0]));
    // 一覧表: 行=素材、列=特性。濃いほど高い。列見出しを押すとその特性で並べ替え
    const matrix = `<div class="mx-wrap"><table class="mx">
      <thead><tr><th>素材</th>${TRAITS.map((t) => `<th title="${esc(t.label)}: ${esc(t.hint)}">${esc(t.short || t.label)}</th>`).join("")}<th title="乾燥機への向き不向き(目安)">乾燥機</th><th>件数</th></tr></thead>
      <tbody>${list.map(([m, v]) => `<tr><th><button class="link-btn" data-guide-mat="${esc(m)}" ${cnt(m) ? "" : "disabled"}><span class="dot" style="background:${MAT_COLOR[m]}"></span>${esc(m)}</button></th>
        ${TRAITS.map((t) => `<td style="--v:${v.t[t.key]}" aria-label="${esc(t.label)} ${v.t[t.key]}">${v.t[t.key]}</td>`).join("")}<td class="dmc dm${DRY[m] ? DRY[m].lv : ""}" title="${esc(DRY[m] ? DRY[m].why : "")}">${DRY[m] ? DRY_LABEL[DRY[m].lv] : "—"}</td><td class="n">${cnt(m)}</td></tr>`).join("")}</tbody></table></div>`;
    openDlg("素材の特徴", `<p class="note">素材ごとの一般的な傾向(5段階の目安。濃いほど高い)。素材名を押すとその素材を含む商品を表示します。</p>
      ${matrix}
      <h3>素材ごとの説明</h3>
      <div class="guide">${list.map(([m, v]) => `<div class="gcard"><h4><span class="dot" style="background:${MAT_COLOR[m]}"></span>${esc(m)}<span class="note">${v.group}・${cnt(m)}件</span></h4>
        <p>${esc(v.note)}</p>${DRY[m] ? `<p class="note">乾燥機: <b class="dm${DRY[m].lv}">${DRY_LABEL[DRY[m].lv]}</b> — ${esc(DRY[m].why)}</p>` : ""}${traitBars(v.t, false)}
        <button class="ghost-btn" data-guide-mat="${esc(m)}" ${cnt(m) ? "" : "disabled"}>${esc(m)}を含む商品を見る</button></div>`).join("")}</div>`);
  }

  function openAbout() {
    const b = Object.entries(DATA.brands).map(([k, v]) => `${BRAND_LABEL[k] || k}: ${v.count}件(${v.fetchedAt}取得)`).join(" / ");
    openDlg("このサイトについて", `<div style="max-width:720px">
      <p><b>洗濯ナビ</b>は、ブランドをまたいで服を「洗濯表示(洗濯機・乾燥機)」「素材」「素材の特性」で探して比べるための<b>非公式</b>サイトです。掲載ブランドとは関係ありません。</p>
      <h3>データについて</h3>
      <p>${esc(b) || "データなし"}</p>
      <p>商品名・価格・素材・色・サイズ・評価は、各ブランドの公式サイトで公開されている情報を取得時点で集めたものです。価格や在庫は変わります。<b>購入前に必ず公式サイトで確認してください。</b></p>
      <p>商品画像は公式サイト上の画像を直接表示しており、このサイトには保存していません。</p>
      <h3>厚さの目安・価格表示</h3>
      <p>「厚さの目安」は商品名・公式の機能表示・中わたの有無から推定しています(例: エアリズム・シアー → 薄手、極暖・ダウン・ボア → 厚手)。「期間限定価格」「値下げ」は公式サイトの表示をそのまま出しています。</p>
      <h3>洗濯・乾燥の表示</h3>
      <p>「洗濯機OK」「乾燥機OK/NG」は各ブランド公式の洗濯表示と取り扱い注意の文から読み取っています。公式に書かれていない項目は「表示なし」としています。「素材から見た乾燥機の目安」は、繊維の一般的な性質(綿は縮みやすい、ウールはフェルト化する など)から出した参考情報で、本体の10%以上を占める素材のうち一番弱いものに合わせています。実際に乾燥機を使えるかは公式の洗濯表示を優先してください。</p>
      <h3>素材の特性の計算方法</h3>
      <p>素材ごとの一般的な傾向を5段階で決め(「素材の特徴」参照)、本体素材の混率で重み付け平均しています。ポリウレタンを含む場合は伸縮性を、ダウン等の中わたがある場合やヒートテック・フリースなど保温を売りにした商品は保温性を上げています。生地の厚さ・織り方・加工は考慮していないため、あくまで目安です。</p>
      <h3>個人情報</h3><p>このサイトは個人情報を集めません。絞り込みの条件や比較中の商品はページのURLに、お気に入りはこの端末のブラウザ内にだけ保存され、どこにも送信されません。</p></div>`);
  }

  /* ---------- 操作 ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }
  function changed() { S.preset = ""; shown = PAGE; render(); }
  function toggleSet(set, v) { set.has(v) ? set.delete(v) : set.add(v); }
  function toggleCmp(id) {
    if (cmp.includes(id)) cmp = cmp.filter((x) => x !== id);
    else if (cmp.length >= MAX_CMP) { toast(`比較は${MAX_CMP}件までです。どれかを外してください`); return false; }
    else { cmp.push(id); toast("比較に追加しました"); }
    return true;
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, [data-open]");
    if (!t) return;
    const d = t.dataset;
    if (d.open) { openDetail(d.open); return; }
    if (d.fav) {
      const on = !favs.has(d.fav);
      on ? favs.add(d.fav) : favs.delete(d.fav);
      saveFavs();
      document.querySelectorAll(`[data-fav="${CSS.escape(d.fav)}"]`).forEach((b) => {
        b.setAttribute("aria-pressed", String(on)); b.textContent = on ? "♥" : "♡";
        b.setAttribute("aria-label", `お気に入り${on ? "から外す" : "に追加"}`);
      });
      $("fav-count").hidden = !favs.size; $("fav-count").textContent = favs.size;
      if (S.favOnly && !on) render();
      return;
    }
    if (d.cmp) {
      if (toggleCmp(d.cmp)) {
        const inDlg = t.closest("#dlg");
        render();
        if (inDlg) openDetail(d.cmp);
      }
      return;
    }
    if (d.uncmp) {
      cmp = cmp.filter((x) => x !== d.uncmp);
      render();
      if (d.recmp) { cmp.length >= 2 ? openCompare($("only-diff")?.checked) : $("dlg").close(); }
      return;
    }
    if (d.preset) {
      const pr = PRESETS.find((x) => x.id === d.preset);
      const was = S.preset === pr.id;
      const keepQ = S.q;
      S = blank();
      S.q = keepQ;
      if (!was) {
        S.preset = pr.id;
        if (pr.patch.traits) S.traits = { ...pr.patch.traits };
        if (pr.patch.mats) S.mats = new Map(pr.patch.mats);
        if (pr.patch.matMin) S.matMin = pr.patch.matMin;
        if (pr.patch.care) S.care = new Set(pr.patch.care);
        if (pr.patch.thick) S.thick = new Set(pr.patch.thick);
        if (pr.patch.sale) S.sale = true;
        if (pr.patch.sort) S.sort = pr.patch.sort;
        else if (pr.patch.traits) S.sort = `t:${Object.keys(pr.patch.traits)[0]}`;
      }
      shown = PAGE; render(); return;
    }
    if (d.rm) {
      removeCond(S, d.rm);
      if (d.rm === "q") $("q").value = "";
      changed(); return;
    }
    if (d.guideMat) {
      S = blank(); S.mats.set(d.guideMat, "in"); S.sort = "mat";
      $("q").value = ""; $("dlg").close(); shown = PAGE; render(); window.scrollTo({ top: 0 }); return;
    }
    if (d.swatch !== undefined && t.classList.contains("swatch")) {
      const p = BY_ID.get(t.parentElement.dataset.pid);
      const src = p && p.imgs && p.imgs[d.swatch];
      t.parentElement.querySelectorAll(".swatch").forEach((s) => s.setAttribute("aria-pressed", String(s === t)));
      if (src) $("detail-img").innerHTML = img(p, "", src);
      return;
    }
    switch (d.k) {
      case "brand": toggleSet(S.brands, d.v); break;
      case "gender": toggleSet(S.genders, d.v); break;
      case "cat": toggleSet(S.cats, d.v); break;
      case "color": toggleSet(S.colors, d.v); break;
      case "size": toggleSet(S.sizes, d.v); break;
      case "tag": toggleSet(S.tags, d.v); break;
      case "thick": toggleSet(S.thick, d.v); break;
      case "care": toggleSet(S.care, d.v); break;
      case "mat": {
        const st = S.mats.get(d.v);
        if (st === matPick) S.mats.delete(d.v); else S.mats.set(d.v, matPick);
        break;
      }
      case "matPick": matPick = d.v; renderFilters(); return;
      case "matMode": S.matMode = d.v; break;
      case "trait": S.traits[d.t] = Number(d.v); if (!S.traits[d.t]) delete S.traits[d.t]; break;
      case "prange": {
        const [a, b] = d.v.split("-");
        const same = String(S.pmin) === String(Number(a) || "") && String(S.pmax) === String(b);
        S.pmin = same ? "" : (Number(a) || ""); S.pmax = same ? "" : b;
        break;
      }
      default: return;
    }
    changed();
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "only-diff") { openCompare(t.checked); return; }
    const k = t.dataset.k;
    if (k === "matMin") S.matMin = Number(t.value);
    else if (k === "pmin" || k === "pmax") S[k] = t.value ? String(Math.max(0, Math.round(Number(t.value)))) : "";
    else if (k === "sale") S.sale = t.checked;
    else if (t.id === "sort") S.sort = t.value;
    else return;
    changed();
  });

  $("filter-body").addEventListener("toggle", (e) => {
    const g = e.target.dataset && e.target.dataset.g;
    if (g) e.target.open ? openGroups.add(g) : openGroups.delete(g);
  }, true);

  let qTimer;
  $("q").addEventListener("input", (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { S.q = e.target.value.trim(); shown = PAGE; render(); }, 120);
  });
  $("sort").innerHTML = SORTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  $("more").addEventListener("click", () => {
    shown += PAGE;
    $("grid").insertAdjacentHTML("beforeend", lastList.slice(shown - PAGE, shown).map(card).join(""));
    $("more").hidden = lastList.length <= shown;
    $("more").textContent = `もっと見る(残り${lastList.length - shown}件)`;
  });
  $("reset").addEventListener("click", () => { S = blank(); $("q").value = ""; shown = PAGE; render(); });
  // 使い方の案内: 閉じたらこの端末では出さない(保存できない環境では毎回出る)
  const HOWTO_KEY = "sentaku-navi:howto-closed";
  let howtoClosed = false;
  try { howtoClosed = localStorage.getItem(HOWTO_KEY) === "1"; } catch (e) { /* 読めない環境 */ }
  $("howto").hidden = howtoClosed;
  $("howto-close").addEventListener("click", () => {
    $("howto").hidden = true;
    try { localStorage.setItem(HOWTO_KEY, "1"); } catch (e) { /* 保存不可 */ }
  });
  $("fav-only").addEventListener("click", () => {
    if (!favs.size && !S.favOnly) { toast("♡ を押した商品がここに集まります"); return; }
    S.favOnly = !S.favOnly; shown = PAGE; render();
  });
  $("logo").addEventListener("click", (e) => { e.preventDefault(); S = blank(); cmp = []; $("q").value = ""; shown = PAGE; render(); });
  $("tray-open").addEventListener("click", () => openCompare());
  $("tray-clear").addEventListener("click", () => { cmp = []; render(); });
  $("dlg-close").addEventListener("click", () => $("dlg").close());
  $("dlg").addEventListener("close", () => { openView = ""; toHash(); });
  $("dlg").addEventListener("click", (e) => { if (e.target === $("dlg")) $("dlg").close(); });
  $("open-guide").addEventListener("click", openGuide);
  $("open-about").addEventListener("click", openAbout);
  const sheet = (open) => {
    $("filters").classList.toggle("open", open);
    $("scrim").hidden = !open;
    // シートの裏側は操作できないようにして、フォーカスをシートの中に置く
    for (const el of document.querySelectorAll(".results, .top, .tray, .foot")) el.inert = open;
    if (open) $("close-filters").focus();
  };
  $("open-filters").addEventListener("click", () => sheet(true));
  $("close-filters").addEventListener("click", () => sheet(false));
  $("scrim").addEventListener("click", () => sheet(false));
  $("apply-filters").addEventListener("click", () => { sheet(false); window.scrollTo({ top: 0 }); });
  document.addEventListener("click", (e) => {
    if (e.target.id === "copy-link" || e.target.id === "copy-search") {
      navigator.clipboard?.writeText(location.href).then(() => toast("リンクをコピーしました"), () => toast("コピーできませんでした"));
    }
  });
  document.addEventListener("keydown", (e) => {
    const sheetOpen = $("filters").classList.contains("open");
    if (e.key === "Escape" && sheetOpen) { e.preventDefault(); sheet(false); $("open-filters").focus(); return; }
    if (e.key === "/" && document.activeElement.tagName !== "INPUT" && !$("dlg").open && !sheetOpen) { e.preventDefault(); $("q").focus(); }
  });

  const b = Object.entries(DATA.brands).map(([k, v]) => `${BRAND_LABEL[k] || k} ${v.count}件(${v.fetchedAt}時点)`).join("、");
  $("data-note").textContent = b ? `掲載データ: ${b}` : "";

  const openOnLoad = new URLSearchParams(location.hash.slice(1)).get("open");
  fromHash();
  $("q").value = S.q;
  render();
  if (openOnLoad === "cmp") openCompare();
  else if (openOnLoad === "guide") openGuide();
  else if (openOnLoad && BY_ID.has(openOnLoad)) openDetail(openOnLoad);
})();
