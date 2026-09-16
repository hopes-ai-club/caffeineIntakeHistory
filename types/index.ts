/** あらかじめ用意する飲料と、1回分のカフェイン量の目安。 */
export interface Preset {
  /** プリセットを識別する固定ID。 */
  readonly id: string;
  readonly name: string;
  /** カフェイン量（mg）。 */
  readonly caffeineMg: number;
}

/** プリセット選択または手動入力による1回分の摂取記録。 */
export interface IntakeRecord {
  /** 記録を識別する一意なID。 */
  id: string;
  /** 手動入力の場合は null。 */
  presetId: Preset["id"] | null;
  /** 記録時点の飲料名。手動入力の場合は入力された名前。 */
  name: string;
  /** 実際に摂取したカフェイン量（mg）。 */
  caffeineMg: number;
  /** 摂取日時。UTCのISO 8601文字列（例: 2026-09-16T03:00:00.000Z）。 */
  consumedAt: string;
}

/** ユーザーが変更・保存できる設定。固定の半減期5時間は含めない。 */
export interface Settings {
  /** 1日のカフェイン摂取上限（mg）。デフォルト値は400。 */
  dailyLimitMg: number;
  /** 毎日の就寝時刻。ローカル時刻の24時間表記 HH:mm（例: 23:00）。 */
  bedtime: string;
}
