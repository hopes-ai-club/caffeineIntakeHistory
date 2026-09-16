/** 日付は端末のローカルタイムゾーンで扱う。 */
export function assertDate(date: Date): void {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid date");
}

export function isBedtime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

const pad = (value: number) => String(value).padStart(2, "0");

export function toDatetimeLocal(date: Date): string {
  assertDate(date);
  return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** datetime-local の分精度入力をUTCへ変換。不正日付・DSTで存在しない時刻は拒否。 */
export function fromDatetimeLocal(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || toDatetimeLocal(date) !== value) return null;
  return date.toISOString();
}

export function startOfDay(date: Date): Date {
  assertDate(date);
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** 今日の就寝時刻。既に過ぎていても翌日に繰り越さない。 */
export function getBedtime(date: Date, bedtime: string): Date {
  if (!isBedtime(bedtime)) throw new RangeError("Invalid bedtime");
  const result = startOfDay(date);
  const [hours, minutes] = bedtime.split(":").map(Number);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function formatTime(date: Date): string {
  assertDate(date);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateLabel(date: Date): string {
  assertDate(date);
  return new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(date);
}
