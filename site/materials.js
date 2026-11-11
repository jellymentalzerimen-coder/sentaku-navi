/* 素材ごとの特性(一般的な傾向の目安。1=低い 〜 5=高い)
 * 出典: 繊維の一般的な性質(吸湿率・熱特性など)をもとにした目安。生地の織り方・厚み・加工で大きく変わる。
 * 商品の特性値は、本体素材の混率で重み付けした平均で計算する(app.js の productTraits)。 */
window.SN_TRAITS = [
  { key: "absorb", label: "吸湿性", short: "吸湿", hint: "汗や湿気を吸う" },
  { key: "dry", label: "速乾性", short: "速乾", hint: "濡れても早く乾く" },
  { key: "warm", label: "保温性", short: "保温", hint: "暖かさ" },
  { key: "breath", label: "通気性", short: "通気", hint: "蒸れにくさ・涼しさ" },
  { key: "wrinkle", label: "シワになりにくさ", short: "防シワ", hint: "アイロンいらず" },
  { key: "stretch", label: "伸縮性", short: "伸縮", hint: "伸びて動きやすい" },
  { key: "durable", label: "丈夫さ", short: "丈夫", hint: "摩擦・洗濯への強さ" },
  { key: "soft", label: "肌ざわり", short: "肌触り", hint: "やわらかさ・刺激の少なさ" },
  { key: "static", label: "静電気の起きにくさ", short: "静電気", hint: "冬のパチパチ(高いほど起きにくい)" },
];

window.SN_MATERIALS = {
  綿: { group: "天然", t: { absorb: 5, dry: 2, warm: 3, breath: 4, wrinkle: 2, stretch: 2, durable: 4, soft: 5, static: 5 },
    note: "汗をよく吸い肌ざわりがよい。乾きにくく、シワになりやすい。" },
  麻: { group: "天然", t: { absorb: 5, dry: 5, warm: 1, breath: 5, wrinkle: 1, stretch: 1, durable: 4, soft: 3, static: 5 },
    note: "通気性と速乾性が高く夏向き。シワになりやすく、ややハリがある。" },
  毛: { group: "天然", t: { absorb: 4, dry: 3, warm: 5, breath: 3, wrinkle: 5, stretch: 3, durable: 3, soft: 3, static: 3 },
    note: "ウール。暖かく、シワが戻りやすい。チクチク感や縮みに注意。" },
  カシミヤ: { group: "天然", t: { absorb: 4, dry: 3, warm: 5, breath: 3, wrinkle: 4, stretch: 3, durable: 2, soft: 5, static: 3 },
    note: "軽くて非常に暖かく、なめらか。摩擦に弱く毛玉ができやすい。" },
  絹: { group: "天然", t: { absorb: 4, dry: 3, warm: 4, breath: 4, wrinkle: 2, stretch: 2, durable: 2, soft: 5, static: 3 },
    note: "シルク。光沢となめらかさ。水や摩擦に弱く、扱いに気をつかう。" },
  レーヨン: { group: "再生", t: { absorb: 5, dry: 3, warm: 2, breath: 4, wrinkle: 1, stretch: 2, durable: 2, soft: 5, static: 4 },
    note: "ひんやりとなめらか。水に濡れると弱く、縮みやすい。" },
  リヨセル: { group: "再生", t: { absorb: 5, dry: 3, warm: 2, breath: 4, wrinkle: 2, stretch: 2, durable: 3, soft: 5, static: 4 },
    note: "テンセル™など。レーヨンに近い風合いで、濡れても比較的強い。" },
  モダール: { group: "再生", t: { absorb: 5, dry: 3, warm: 2, breath: 4, wrinkle: 2, stretch: 2, durable: 3, soft: 5, static: 4 },
    note: "やわらかくとろみがある。インナーや部屋着に多い。" },
  キュプラ: { group: "再生", t: { absorb: 5, dry: 3, warm: 2, breath: 4, wrinkle: 2, stretch: 2, durable: 2, soft: 5, static: 5 },
    note: "静電気が起きにくく、すべりがよい。裏地によく使われる。" },
  アセテート: { group: "半合成", t: { absorb: 3, dry: 3, warm: 2, breath: 3, wrinkle: 3, stretch: 2, durable: 2, soft: 4, static: 3 },
    note: "光沢があり、しなやか。熱と摩擦に弱い。" },
  ポリエステル: { group: "合成", t: { absorb: 1, dry: 5, warm: 3, breath: 2, wrinkle: 5, stretch: 2, durable: 5, soft: 3, static: 2 },
    note: "丈夫で乾きやすく、シワになりにくい。汗は吸いにくく、静電気が起きやすい。" },
  ナイロン: { group: "合成", t: { absorb: 2, dry: 4, warm: 2, breath: 2, wrinkle: 4, stretch: 3, durable: 5, soft: 3, static: 2 },
    note: "摩擦に非常に強く軽い。アウターや靴下の補強に多い。" },
  アクリル: { group: "合成", t: { absorb: 1, dry: 4, warm: 4, breath: 2, wrinkle: 4, stretch: 2, durable: 3, soft: 4, static: 1 },
    note: "ウールに似た暖かさで軽い。毛玉と静電気が起きやすい。" },
  ポリウレタン: { group: "合成", t: { absorb: 1, dry: 4, warm: 2, breath: 2, wrinkle: 4, stretch: 5, durable: 2, soft: 3, static: 3 },
    note: "よく伸びる。少量混ぜてストレッチ性を出す。経年で劣化する。" },
  ポリプロピレン: { group: "合成", t: { absorb: 1, dry: 5, warm: 3, breath: 2, wrinkle: 4, stretch: 2, durable: 4, soft: 3, static: 2 },
    note: "とても軽く、水を吸わない。" },
  "指定外繊維": { group: "その他", t: null,
    note: "法律上の分類にない繊維。商品ごとに中身が違う(かっこ内の表記を参照)。" },
};

/* 乾燥機(タンブル乾燥)への向き不向き(繊維の一般的な性質による目安)
 * lv: 2 = 向く / 1 = 注意(縮み・傷み・熱に注意。低温なら可のことが多い) / 0 = 不向き
 * 実際に使えるかは商品ごとの洗濯表示が優先(app.js では公式表示を先に出す) */
window.SN_DRYER = {
  綿: { lv: 1, why: "縮みやすい(特にニット・未加工の生地)" },
  麻: { lv: 1, why: "縮みやすく、シワが強く付く" },
  毛: { lv: 0, why: "熱と揉みで縮んでフェルト化する" },
  カシミヤ: { lv: 0, why: "熱と揉みで縮み、風合いが損なわれる" },
  絹: { lv: 0, why: "熱と摩擦に弱く、傷みやすい" },
  レーヨン: { lv: 0, why: "水に濡れると弱く、縮み・型崩れしやすい" },
  リヨセル: { lv: 1, why: "縮みや毛羽立ちが出やすい" },
  モダール: { lv: 1, why: "縮みやすい" },
  キュプラ: { lv: 0, why: "水と摩擦に弱く、縮み・シワが出やすい" },
  アセテート: { lv: 0, why: "熱に弱く、変形・テカリが出る" },
  ポリエステル: { lv: 2, why: "熱に比較的強く縮みにくい(高温は避ける)" },
  ナイロン: { lv: 1, why: "熱に弱めで、高温だと傷む(低温なら可のことが多い)" },
  アクリル: { lv: 0, why: "熱で伸びたり縮んだりして形が崩れる" },
  ポリウレタン: { lv: 1, why: "熱で劣化し、伸びが戻らなくなる" },
  ポリプロピレン: { lv: 0, why: "熱に弱く、溶けたり縮んだりする" },
};
