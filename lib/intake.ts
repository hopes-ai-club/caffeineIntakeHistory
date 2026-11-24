import type { IntakeRecord } from "../types";
import { formatTime, isBedtime, isSameDay } from "./datetime";

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

/** 保存済みのローカル日付を保ったまま、現在以前の分精度の時刻だけへ置き換える。 */
export function replaceIntakeRecordTime(record: IntakeRecord, time: string, now = new Date()): IntakeRecord | null {
  if (!isBedtime(time)) return null;
  const original = new Date(record.consumedAt);
  if (!Number.isFinite(original.getTime()) || !Number.isFinite(now.getTime())) return null;

  const [hours, minutes] = time.split(":").map(Number);
  const updated = new Date(original);
  updated.setHours(hours, minutes, 0, 0);

  // DSTで存在しないローカル時刻はsetHoursが補正するため、入力値との一致も確認する。
  if (!isSameDay(original, updated) || formatTime(updated) !== time || updated.getTime() > now.getTime()) return null;
  return { ...record, consumedAt: updated.toISOString() };
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
