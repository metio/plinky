// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Illustrates the help page with real screenshots: serves the built site, drives
// Chromium to each app section, screenshots it, uploads each picture as a Sanity
// image asset, and patches the section's seeded help block (`help-<key>-intro`)
// to carry it, alongside the alt text in every locale. Requires a token with the
// Editor role in SANITY_AUTH_TOKEN; project and dataset come from
// SANITY_STUDIO_PROJECT_ID / SANITY_STUDIO_DATASET. Rerunning replaces the
// pictures — the body text is untouched.
//
// The alt text is read from seed/help.ndjson rather than kept here, so the seed
// stays the one source of truth for every translated string on the help page: a
// patch that carried its own English-only alt would silently drop 25 locales'
// translations each time this runs.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const ROOT = "build/client";
const SEED_PATH = "studio/seed/help.ndjson";
const PORT = Number(process.env.PORT) || 8098;

const PROJECT = process.env.SANITY_STUDIO_PROJECT_ID;
const DATASET = process.env.SANITY_STUDIO_DATASET || "production";
const TOKEN = process.env.SANITY_AUTH_TOKEN;
// A dry run writes the pictures to this directory instead of touching Sanity —
// for eyeballing the screenshots before spending real asset uploads.
const DRY_RUN_DIR = process.env.HELP_SHOTS_DIR;
if (!DRY_RUN_DIR && (!PROJECT || !TOKEN)) {
    console.error("SANITY_STUDIO_PROJECT_ID and SANITY_AUTH_TOKEN are required.");
    process.exit(1);
}

// The play page needs a piece; any prerendered one will do.
const playId = readdirSync(join(ROOT, "en", "play"), { withFileTypes: true }).find((entry) =>
    entry.isDirectory(),
)?.name;

// The seeded help blocks, by section key — the source of the alt text this
// script patches back alongside each picture.
const SEED = new Map(
    readFileSync(SEED_PATH, "utf8")
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line))
        .map((doc) => [doc._id.replace(/^help-|-intro$/g, ""), doc]),
);

// One screenshot per help section: the page it explains. `selector` waits for the
// page's real content before shooting; the play page is ready once the score's
// SVG exists. Alt text comes from the seed, in every locale.
const SECTIONS = [
    {
        key: "gettingStarted",
        path: "/en/",
        selector: "main",
    },
    {
        key: "home",
        path: "/en/",
        selector: "main",
    },
    {
        key: "play",
        path: `/en/play/${playId}`,
        selector: "svg",
    },
    {
        key: "library",
        path: "/en/library",
        selector: "main",
    },
    {
        key: "daily",
        path: "/en/daily",
        selector: "main",
    },
    {
        key: "compose",
        path: "/en/compose",
        selector: "main",
    },
    {
        key: "assignments",
        path: "/en/assignments",
        selector: "main",
    },
    {
        key: "you",
        path: "/en/you",
        selector: "main",
    },
    {
        key: "review",
        path: "/en/review",
        selector: "main",
    },
    {
        key: "settings",
        path: "/en/settings",
        selector: "main",
    },
];

const MIME = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".mxl": "application/octet-stream",
    ".webmanifest": "application/manifest+json",
};

// A static server matching how GitHub Pages serves the build: directory URLs map
// to their index.html, and unknown paths fall back to the SPA shell.
const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (path.endsWith("/")) {
        path += "index.html";
    }
    let file = join(ROOT, path);
    if (existsSync(file) && statSync(file).isDirectory()) {
        file = join(file, "index.html");
    }
    if (!existsSync(file)) {
        file = join(ROOT, "index.html");
    }
    res.setHeader("content-type", MIME[extname(file)] ?? "application/octet-stream");
    res.end(readFileSync(file));
});

const api = `https://${PROJECT}.api.sanity.io/v2024-01-01`;

async function uploadImage(png, filename) {
    const response = await fetch(`${api}/assets/images/${DATASET}?filename=${filename}`, {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}`, "content-type": "image/png" },
        body: png,
    });
    if (!response.ok) {
        throw new Error(`asset upload failed (${response.status}): ${await response.text()}`);
    }
    return (await response.json()).document._id;
}

async function patchBlock(key, assetId) {
    const alt = SEED.get(key)?.alt;
    if (!alt) {
        throw new Error(
            `no seeded help block for ${key} — is studio/seed/help.ndjson in step with SECTIONS?`,
        );
    }
    const response = await fetch(`${api}/data/mutate/${DATASET}`, {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({
            mutations: [
                {
                    patch: {
                        id: `help-${key}-intro`,
                        set: {
                            image: {
                                _type: "image",
                                asset: { _type: "reference", _ref: assetId },
                            },
                            alt,
                        },
                    },
                },
            ],
        }),
    });
    if (!response.ok) {
        throw new Error(`patch ${key} failed (${response.status}): ${await response.text()}`);
    }
}

await new Promise((resolve) => server.listen(PORT, resolve));
const browser = await chromium.launch();
const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: "light",
});

let failed = false;
for (const section of SECTIONS) {
    try {
        await page.goto(`http://localhost:${PORT}${section.path}`, { waitUntil: "networkidle" });
        await page.waitForSelector(section.selector, { timeout: 30_000 });
        // Let web fonts and late layout settle so the picture is what users see.
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(500);
        const png = await page.screenshot({ type: "png" });
        if (DRY_RUN_DIR) {
            writeFileSync(join(DRY_RUN_DIR, `help-${section.key}.png`), png);
            console.log(`${section.key}: written to ${DRY_RUN_DIR}`);
            continue;
        }
        const assetId = await uploadImage(png, `help-${section.key}.png`);
        await patchBlock(section.key, assetId);
        console.log(`${section.key}: uploaded + patched (${assetId})`);
    } catch (error) {
        failed = true;
        console.error(`${section.key}: ${error.message}`);
    }
}

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
