import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// 追加依存なしでTSを一時ディレクトリへコンパイルし、Node標準テストで検証する。
const output = mkdtempSync(join(tmpdir(), "caffeine-tests-"));
try {
  const compile = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc",
    "--outDir", output, "--module", "commonjs", "--target", "ES2020", "--strict", "--skipLibCheck",
    "lib/caffeine.ts", "lib/datetime.ts", "lib/storage.ts", "data/presets.ts",
  ], { stdio: "inherit" });
  if (compile.error) throw compile.error;
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    for (const timezone of ["Asia/Tokyo", "America/New_York"]) {
      console.log(`Testing timezone: ${timezone}`);
      const run = spawnSync(process.execPath, ["--test", "tests/logic.test.mjs"], {
        stdio: "inherit", env: { ...process.env, TZ: timezone, LOGIC_BUILD_DIR: output },
      });
      if (run.error) throw run.error;
      if (run.status !== 0) process.exitCode = run.status ?? 1;
    }
  }
} finally { rmSync(output, { recursive: true, force: true }); }
