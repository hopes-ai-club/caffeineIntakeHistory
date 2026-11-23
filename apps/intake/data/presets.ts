import type { Preset } from "../types";

/** 1回分の目安。抽出条件・製品で異なるため、入力時に量を編集できる。出典は下記参照。 */
export const PRESETS: readonly Preset[] = Object.freeze([
  { id: "drip-coffee", name: "ドリップコーヒー（150ml）", caffeineMg: 90 },
  { id: "espresso", name: "エスプレッソ（30ml）", caffeineMg: 60 },
  { id: "instant-coffee", name: "インスタントコーヒー（140ml）", caffeineMg: 80 },
  { id: "canned-coffee", name: "缶コーヒー（185g）", caffeineMg: 74 },
  { id: "decaf-coffee", name: "デカフェコーヒー（237ml）", caffeineMg: 3 },
  { id: "black-tea", name: "紅茶（200ml）", caffeineMg: 60 },
  { id: "green-tea", name: "緑茶（200ml）", caffeineMg: 40 },
  { id: "oolong-tea", name: "烏龍茶（200ml）", caffeineMg: 40 },
  { id: "cola", name: "コーラ（355ml）", caffeineMg: 36 },
  { id: "energy-drink", name: "エナジードリンク（250ml）", caffeineMg: 80 },
].map((preset) => Object.freeze(preset)));

/*
 * 目安の出典（2026-09-16確認）:
 * ドリップ・インスタント・紅茶・緑茶: 食品安全委員会（60/57/30/20 mg per 100ml）。
 * https://www.fsc.go.jp/fsciis/attachedFile/download?fileId=590&retrievalId=kai20110331sfc
 * エスプレッソ: UC Davis（1oz 47–64mgの範囲から60mgを採用）。
 * https://nutrition.ucdavis.edu/outreach/nutr-health-info-sheets/pro-caffeine
 * デカフェ・コーラ: Health Canada（237ml 3mg / 355ml 36–46mgの下限）。
 * https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-additives/caffeine-foods.html
 * 缶コーヒー: ボス無糖ブラック（40mg/100g）を185gへ換算。
 * https://products.suntory.co.jp/softdrink/ingredient.html?ke=hd
 * 烏龍茶: サントリー黒烏龍茶（20mg/100ml）を200mlへ換算。
 * https://www.suntory.co.jp/softdrink/products/0000000031/HB25L.html
 * エナジードリンク: Red Bull（250ml 80mg）を代表例として採用。
 * https://www.redbull.com/jp-ja/energydrink/questions/how-much-caffeine-is-in-a-can-of-red-bull-energy-drink
 */
