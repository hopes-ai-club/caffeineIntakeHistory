import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const load = (path) => require(join(process.env.LOGIC_BUILD_DIR, path));
const caffeine = load("lib/caffeine.js");
const datetime = load("lib/datetime.js");
const storage = load("lib/storage.js");
const { PRESETS } = load("data/presets.js");
const date = (value) => new Date(value);
const record = (at, mg = 100, extra = {}) => ({
  id: at, presetId: "coffee", name: "コーヒー", caffeineMg: mg,
  consumedAt: date(at).toISOString(), ...extra,
});
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const settings = { dailyLimitMg: 400, bedtime: "23:00" };
const memory = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test("10 immutable presets have stable unique IDs, serving sizes and positive amounts", () => {
  assert.equal(PRESETS.length, 10);
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, 10);
  for (const p of PRESETS) {
    assert.match(p.name, /（\d+(ml|g)）/);
    assert.ok(Number.isFinite(p.caffeineMg) && p.caffeineMg > 0);
    assert.ok(Object.isFrozen(p));
  }
  assert.ok(Object.isFrozen(PRESETS));
});

test("residual includes exact intake instant, halves in 5h, excludes future", () => {
  const records = [record("2026-09-16T08:00:00Z")];
  assert.equal(caffeine.calculateResidualMg([], date("2026-09-16")), 0);
  assert.equal(caffeine.calculateResidualMg(records, date("2026-09-16T07:59:59Z")), 0);
  assert.equal(caffeine.calculateResidualMg(records, date("2026-09-16T08:00:00Z")), 100);
  close(caffeine.calculateResidualMg(records, date("2026-09-16T13:00:00Z")), 50);
  close(caffeine.calculateResidualMg(records, date("2026-09-16T18:00:00Z")), 25);
  close(caffeine.calculateResidualMg([...records, record("2026-09-16T13:00:00Z", 60)], date("2026-09-16T13:00:00Z")), 110);
  assert.throws(() => caffeine.calculateResidualMg([record("2026-09-16", -1)], date("2026-09-16")), RangeError);
  assert.throws(() => caffeine.calculateResidualMg(records, new Date(NaN)), RangeError);
});

test("today uses local midnight, excludes future and groups manual names separately", () => {
  const now = date("2026-09-16T12:00:00");
  const records = [
    record("2026-09-15T23:59:59", 80),
    record("2026-09-16T00:00:00", 100),
    record("2026-09-16T09:00:00", 60, { name: "新しい名前" }),
    record("2026-09-16T10:00:00", 20, { presetId: null, name: " コーヒー " }),
    record("2026-09-16T12:00:00", 30, { presetId: null }),
    record("2026-09-16T12:00:01", 200),
    record("2026-09-17T00:00:00", 100),
  ];
  const before = JSON.stringify(records);
  assert.equal(caffeine.calculateTodayTotalMg(records, now), 210);
  assert.deepEqual(caffeine.getTodayBreakdown(records, now), [
    { presetId: "coffee", name: "コーヒー", count: 2, totalMg: 160 },
    { presetId: null, name: "コーヒー", count: 2, totalMg: 50 },
  ]);
  assert.ok(caffeine.calculateResidualMg(records, now) > caffeine.calculateResidualMg(records.slice(1), now));
  assert.equal(JSON.stringify(records), before);
});

test("curve keeps pre-range residual, off-grid jumps and inclusive endpoint", () => {
  const points = caffeine.sampleResidualCurve([
    record("2026-09-16T03:00:00Z"), record("2026-09-16T08:02:00Z", 60),
  ], date("2026-09-16T08:00:00Z"), date("2026-09-16T08:07:00Z"));
  assert.deepEqual(points.map((p) => p.at), [
    "2026-09-16T08:00:00.000Z", "2026-09-16T08:01:59.999Z",
    "2026-09-16T08:02:00.000Z", "2026-09-16T08:05:00.000Z", "2026-09-16T08:07:00.000Z",
  ]);
  assert.equal(points[0].residualMg, 50);
  assert.ok(points[2].residualMg - points[1].residualMg > 59.99);
  assert.equal(caffeine.sampleResidualCurve([], date("2026-09-16"), date("2026-09-16")).length, 1);
  for (const interval of [0, -1, NaN, Infinity]) {
    assert.throws(() => caffeine.sampleResidualCurve([], date("2026-09-16"), date("2026-09-17"), interval), RangeError);
  }
  assert.throws(() => caffeine.sampleResidualCurve([], date("2026-09-17"), date("2026-09-16")), RangeError);
});

test("residual peak picks the highest sampled point, keeping the earliest on ties", () => {
  assert.equal(caffeine.findResidualPeak([]), null);
  const tied = [
    { at: "2026-09-16T06:00:00.000Z", residualMg: 10 },
    { at: "2026-09-16T07:00:00.000Z", residualMg: 10 },
  ];
  assert.equal(caffeine.findResidualPeak(tied).at, "2026-09-16T06:00:00.000Z");
  const points = caffeine.sampleResidualCurve([
    record("2026-09-16T08:00:00Z", 90), record("2026-09-16T12:00:00Z", 60),
  ], date("2026-09-16T06:00:00Z"), date("2026-09-16T18:00:00Z"), 60);
  const peak = caffeine.findResidualPeak(points);
  assert.equal(peak.at, "2026-09-16T12:00:00.000Z");
  close(peak.residualMg, 60 + 90 * 0.5 ** (4 / 5));
});

test("bedtime prediction and cutoff satisfy both residual and daily budget", () => {
  const now = date("2026-09-16T08:00:00");
  const records = [record("2026-09-16T13:00:00", 100)];
  assert.equal(caffeine.calculateBedtimeResidualMg(records, settings, now), 25);
  const cutoff = caffeine.calculateLastCupTime(records, settings, 100, 50, now);
  assert.equal(datetime.toDatetimeLocal(cutoff), "2026-09-16T13:00");
  close(caffeine.calculateResidualMg([...records, record(cutoff.toISOString())], datetime.getBedtime(now, "23:00")), 50);
  assert.equal(caffeine.calculateLastCupTime(records, { ...settings, dailyLimitMg: 199 }, 100, 50, now), null);
  assert.ok(caffeine.calculateLastCupTime(records, { ...settings, dailyLimitMg: 200 }, 100, 50, now));
  assert.equal(caffeine.calculateLastCupTime(records, settings, 100, 25, now), null);
  assert.equal(caffeine.calculateLastCupTime(records, settings, 100, 24, now), null);
  assert.equal(caffeine.calculateLastCupTime(records, settings, 100, 50, date("2026-09-16T14:00:00")), null);
  assert.equal(caffeine.calculateLastCupTime([], settings, 100, 0.001, now), null);
  assert.equal(caffeine.calculateLastCupTime([], settings, 100, 100, date("2026-09-16T23:01:00")), null);
  assert.equal(datetime.formatTime(caffeine.calculateLastCupTime([], settings, 0, 0, now)), "23:00");
  assert.equal(datetime.formatTime(caffeine.calculateLastCupTime([], settings, 50, 100, now)), "23:00");
  assert.throws(() => caffeine.calculateLastCupTime([], settings, -1, 50, now), RangeError);
});

test("cutoff includes previous-day residual and never exceeds target after rounding", () => {
  const now = date("2026-09-16T00:00:00");
  const records = [record("2026-09-15T23:00:00", 200)];
  const cutoff = caffeine.calculateLastCupTime(records, settings, 90, 40, now);
  assert.ok(cutoff);
  const residual = caffeine.calculateResidualMg([...records, record(cutoff.toISOString(), 90)], datetime.getBedtime(now, "23:00"));
  assert.ok(residual <= 40);
  assert.ok(residual > 39.999);
});

test("quick add candidates rank by 7-day frequency, break ties by recency and use the latest amount", () => {
  const now = date("2026-09-16T12:00:00Z");
  const records = [
    record("2026-09-09T12:00:00Z"), // 丁度7日前境界（含む）
    record("2026-09-09T11:59:59Z"), // 境界より前は除外
    record("2026-09-10T00:00:00Z", 90, { presetId: "espresso", name: "エスプレッソ" }),
    record("2026-09-11T00:00:00Z", 90, { presetId: "espresso", name: "エスプレッソ" }),
    record("2026-09-12T00:00:00Z", 20, { presetId: null, name: " 緑茶 " }),
    record("2026-09-12T00:00:01Z", 20, { presetId: null, name: "緑茶" }),
    record("2026-09-16T13:00:00Z"), // 未来は除外
  ];
  const candidates = caffeine.getQuickAddCandidates(records, now, 2);
  assert.deepEqual(candidates, [
    { presetId: null, name: "緑茶", caffeineMg: 20, count: 2 },
    { presetId: "espresso", name: "エスプレッソ", caffeineMg: 90, count: 2 },
  ]);
  assert.equal(caffeine.getQuickAddCandidates(records, now, 0).length, 0);
  assert.equal(caffeine.getQuickAddCandidates([], now).length, 0);
});

test("local datetime roundtrip, formatting, invalid calendar dates and bedtime", () => {
  const input = "2026-09-16T00:15";
  const iso = datetime.fromDatetimeLocal(input);
  assert.match(iso, /Z$/);
  assert.equal(datetime.toDatetimeLocal(date(iso)), input);
  assert.equal(datetime.formatTime(date(iso)), "00:15");
  assert.match(datetime.formatDateLabel(date(iso)), /9月16日/);
  for (const invalid of ["", "2026-02-30T12:00", "2026-09-16T24:00", "2026-09-16T12:60", "2026-09-16T12:00Z"]) {
    assert.equal(datetime.fromDatetimeLocal(invalid), null);
  }
  assert.equal(datetime.toDatetimeLocal(datetime.getBedtime(date("2026-09-16T23:30:00"), "23:00")), "2026-09-16T23:00");
  assert.throws(() => datetime.getBedtime(date(iso), "24:00"), RangeError);
  if (process.env.TZ === "America/New_York") {
    assert.equal(datetime.fromDatetimeLocal("2026-03-08T02:30"), null);
    const before = datetime.startOfDay(date("2026-03-08T12:00:00"));
    const after = datetime.startOfDay(date("2026-03-09T12:00:00"));
    assert.equal((after - before) / 3_600_000, 23);
  }
});

test("storage defaults and all-history roundtrips", () => {
  const target = memory();
  assert.deepEqual(storage.loadIntakeRecords(target), { ok: true, data: [] });
  assert.deepEqual(storage.loadSettings(target), { ok: true, data: settings });
  const records = [record("2020-01-01T00:00:00Z"), record("2026-09-16T00:00:00Z", 0, { presetId: null })];
  assert.equal(storage.saveIntakeRecords(records, target).ok, true);
  assert.deepEqual(storage.loadIntakeRecords(target), { ok: true, data: records });
  const edited = { dailyLimitMg: 0, bedtime: "00:00" };
  assert.equal(storage.saveSettings(edited, target).ok, true);
  assert.deepEqual(storage.loadSettings(target), { ok: true, data: edited });
});

test("corrupt or unknown storage is reported without mutating stored content", () => {
  const target = memory();
  for (const raw of ["{broken", "null", JSON.stringify({ version: 2, data: [] }), JSON.stringify({ version: 1, data: [{}] })]) {
    target.setItem(storage.STORAGE_KEYS.records, raw);
    assert.deepEqual(storage.loadIntakeRecords(target), { ok: false, error: "invalid-data" });
    assert.equal(target.getItem(storage.STORAGE_KEYS.records), raw);
  }
  const valid = record("2026-09-16T00:00:00Z");
  for (const bad of [{ ...valid, caffeineMg: -1 }, { ...valid, caffeineMg: Infinity }, { ...valid, name: " " },
    { ...valid, consumedAt: "2026-02-30T00:00:00.000Z" }, { ...valid, presetId: undefined }]) {
    assert.equal(storage.saveIntakeRecords([bad], target).error, "invalid-data");
  }
  assert.equal(storage.saveIntakeRecords([valid, valid], target).error, "invalid-data");
  assert.equal(storage.saveSettings({ dailyLimitMg: 400, bedtime: "25:00" }, target).error, "invalid-data");
  assert.equal(storage.saveSettings({ dailyLimitMg: NaN, bedtime: "23:00" }, target).error, "invalid-data");
});

test("SSR, access denial and quota failures are explicit", () => {
  assert.equal(storage.loadIntakeRecords().error, "unavailable");
  assert.equal(storage.loadSettings(null).error, "unavailable");
  assert.equal(storage.saveSettings(settings, null).error, "unavailable");
  const denied = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); } };
  assert.equal(storage.loadSettings(denied).error, "read-failed");
  assert.equal(storage.saveSettings(settings, denied).error, "write-failed");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    get localStorage() { throw new Error("SecurityError"); },
  } });
  try { assert.equal(storage.loadSettings().error, "unavailable"); }
  finally { delete globalThis.window; }
});
