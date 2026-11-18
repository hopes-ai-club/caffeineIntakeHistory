import type { IntakeRecord } from "../types";

export interface NewIntakeRecordData {
  /** 手動入力の場合は null。 */
  presetId: string | null;
  name: string;
  caffeineMg: number;
  /** UTCのISO 8601文字列（ミリ秒付き）。 */
  consumedAt: string;
}

export interface IntakeDraftValidation {
  name: string;
  caffeineMg: number | null;
  nameError: string | null;
  amountError: string | null;
}

/** 手動入力名は保存・集計仕様に合わせて前後の空白を除去する。 */
export function normalizeDrinkName(name: string): string {
  return name.trim();
}

/** 保存前の入力から、名称を正規化した摂取記録を組み立てる。 */
export function createIntakeRecord(input: NewIntakeRecordData, id: string): IntakeRecord {
  return {
    id,
    presetId: input.presetId,
    name: normalizeDrinkName(input.name),
    caffeineMg: input.caffeineMg,
    consumedAt: input.consumedAt,
  };
}

/** 入力フォームの文字列を、保存可能な飲料名と正のカフェイン量へ検証・変換する。 */
export function validateIntakeDraft(nameInput: string, amountInput: string): IntakeDraftValidation {
  const name = normalizeDrinkName(nameInput);
  const amountText = amountInput.trim();
  const caffeineMg = amountText === "" ? null : Number(amountText);

  return {
    name,
    caffeineMg,
    nameError: name === "" ? "飲み物名を入力してください。" : null,
    amountError: amountText === ""
      ? "カフェイン量を入力してください。"
      : caffeineMg === null || !Number.isFinite(caffeineMg) || caffeineMg <= 0
        ? "カフェイン量は0より大きい数値で入力してください。"
        : null,
  };
}
