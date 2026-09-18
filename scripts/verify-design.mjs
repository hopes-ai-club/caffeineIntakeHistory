// Optional local check: npm install --no-save --package-lock=false playwright
// npx playwright install chromium
// Terminal 1: npm run dev
// Terminal 2: node scripts/verify-design.mjs
// Scope: TODO 3-0 foundation sample, not the completed home screen.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const output = await mkdir(join(tmpdir(), `caffeine-design-${Date.now()}`), { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    let light;
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      await page.goto(process.env.DESIGN_URL ?? "http://localhost:3000/", { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const measured = await page.evaluate(() => {
        const selectors = {
          body: "body", main: "main", heading: "h1", card: "section",
          latin: "section p:nth-child(1)", number: "section p:nth-child(2)", time: "section span",
        };
        const styles = Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
          const el = document.querySelector(selector);
          if (!el) throw new Error(`Missing ${selector}`);
          const s = getComputedStyle(el), r = el.getBoundingClientRect();
          return [name, {
            fontSize: s.fontSize, fontWeight: s.fontWeight, fontFamily: s.fontFamily,
            color: s.color, backgroundColor: s.backgroundColor, padding: s.padding,
            gap: s.gap, borderRadius: s.borderRadius, border: s.border,
            width: r.width, height: r.height,
          }];
        }));
        return { styles, overflow: document.documentElement.scrollWidth > innerWidth,
          dark: matchMedia("(prefers-color-scheme: dark)").matches };
      });
      assert.equal(measured.dark, colorScheme === "dark");
      assert.equal(measured.overflow, false, "Horizontal overflow");
      const s = measured.styles;
      assert.equal(s.body.backgroundColor, "rgb(14, 12, 10)");
      assert.equal(s.body.color, "rgb(244, 238, 229)");
      assert.equal(s.main.backgroundColor, "rgb(23, 19, 15)");
      assert.equal(s.main.width, width < 600 ? width : 420);
      assert.equal(s.main.padding, "20px");
      assert.equal(s.heading.fontSize, "26px");
      assert.equal(s.heading.fontWeight, "600");
      assert.equal(s.card.backgroundColor, "rgb(34, 28, 22)");
      assert.equal(s.card.padding, "20px");
      assert.equal(s.card.gap, "16px");
      assert.equal(s.card.borderRadius, "22px");
      assert.equal(s.card.border, "1px solid rgba(244, 238, 229, 0.07)");
      assert.equal(s.number.fontSize, "34px");
      assert.equal(s.number.fontWeight, "500");
      assert.equal(s.number.color, "rgb(232, 145, 63)");
      if (colorScheme === "light") light = measured.styles;
      else assert.deepEqual(measured.styles, light, "Theme changes computed styles");

      const { root } = await cdp.send("DOM.getDocument");
      const renderedFonts = {};
      for (const [selector, family, face] of [
        ["section p:nth-child(1)", "IBM Plex Sans", "Regular"],
        ["section p:nth-child(2)", "IBM Plex Mono", "Medium"],
        ["section span", "IBM Plex Mono", "Regular"],
      ]) {
        const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
        const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
        const used = fonts.filter(font => font.glyphCount > 0);
        assert.ok(used.length > 0, `No rendered glyphs: ${selector}`);
        // CDP may report a weight-specific family, e.g. "IBM Plex Mono Medium".
        // Accept only the expected face, not arbitrary family-name prefixes.
        assert.ok(used.every(font => font.isCustomFont &&
          (font.familyName === family || font.familyName === `${family} ${face}`)),
          `Unexpected rendered font for ${selector}: ${JSON.stringify(used)}`);
        renderedFonts[selector] = used;
      }
      await page.screenshot({ path: join(output, `${width}-${colorScheme}.png`), fullPage: true });
      results.push({ width, colorScheme, measured, renderedFonts });
    }
    assert.deepEqual(errors, [], "Browser errors");
    await page.context().close();
  }
  console.log(`PASS: light/dark emulation, computed styles, rendered fonts. Evidence: ${output}`);
} finally {
  await writeFile(join(output, "measurements.json"), JSON.stringify(results, null, 2));
  await browser.close();
}
