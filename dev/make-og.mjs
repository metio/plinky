// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Generates public/og.png (1200x630), the social-card image, by rendering an
// HTML card with the stacked logo in headless Chromium and screenshotting it.
// Run inside the dev container from the repo root: node dev/make-og.mjs
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const logo = readFileSync("public/logo-stacked.svg", "utf8");

// Mirror the watermark to the canonical SITE_URL so the card never advertises a
// stale domain. Read it straight from site.ts rather than hardcoding a copy.
const siteUrl = readFileSync("app/lib/site.ts", "utf8").match(/SITE_URL\s*=\s*"([^"]+)"/)?.[1];
if (!siteUrl) throw new Error("could not find SITE_URL in app/lib/site.ts");
const host = new URL(siteUrl).host;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  .card{width:1200px;height:630px;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:46px;
    background:linear-gradient(135deg,#eef2ff 0%,#faf5ff 100%);
    font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
  .card svg{width:340px;height:auto}
  .tag{font-size:46px;font-weight:600;color:#374151}
  .url{font-size:26px;color:#9ca3af;letter-spacing:.02em}
</style></head><body><div class="card">
  ${logo}
  <div class="tag">Practice piano in your browser</div>
  <div class="url">${host}</div>
</div></body></html>`;

const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({ path: "public/og.png" });
} finally {
    await browser.close();
}
console.log("wrote public/og.png");
