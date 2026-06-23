// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Validates a song-submission issue: parses the ABC from the form body, checks
// the headers, then renders it with the same abcjs the app uses (in headless
// Chromium) and confirms it produces playable notes — i.e. that Plinky can
// actually use it. Writes `valid` and a markdown `report` to GITHUB_OUTPUT.
import { appendFileSync } from "node:fs";
import { chromium } from "playwright";

const body = process.env.ISSUE_BODY || "";

// Read a field from the issue form's rendered body.
const section = (label) => {
    const re = new RegExp(`###\\s*${label}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n###\\s|$)`, "i");
    const match = body.match(re);
    return match ? match[1].trim() : "";
};

// The ABC field uses render:text, so it arrives wrapped in a fenced block.
let abc = section("ABC notation");
const fenced = abc.match(/^```[a-z]*\r?\n([\s\S]*?)\r?\n```$/);
if (fenced) {
    abc = fenced[1].trim();
}
const license = section("License");

const problems = [];
if (!abc || abc === "_No response_") {
    problems.push("No ABC notation was provided.");
} else {
    if (!/^X:/m.test(abc)) {
        problems.push("Missing the `X:` reference-number header.");
    }
    if (!/^K:/m.test(abc)) {
        problems.push("Missing the `K:` key header.");
    }
}

// Only render once the headers are present (stray text otherwise reads as notes).
let steps = 0;
if (problems.length === 0) {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.addScriptTag({ path: "node_modules/abcjs/dist/abcjs-basic-min.js" });
        steps = await page.evaluate((source) => {
            const element = document.createElement("div");
            document.body.appendChild(element);
            try {
                const tune = window.ABCJS.renderAbc(element, source, {})[0];
                if (!tune) {
                    return 0;
                }
                tune.setUpAudio({});
                const events = tune.setupEvents(0, 1000, 100);
                return events.filter(
                    (event) => event.type === "event" && (event.midiPitches?.length ?? 0) > 0,
                ).length;
            } catch {
                return 0;
            }
        }, abc);
    } finally {
        await browser.close();
    }
    if (steps === 0) {
        problems.push("The notation did not produce any playable notes — Plinky could not use it.");
    }
}

const valid = problems.length === 0;
const lines = [
    valid
        ? `✅ **Looks good!** The notation renders and plays ${steps} note${steps === 1 ? "" : "s"} in Plinky. A maintainer will review it and add it to the catalog.`
        : `⚠️ **This needs a change before it can be added:**\n${problems.map((problem) => `- ${problem}`).join("\n")}`,
];
if (license) {
    lines.push(`\nLicense: \`${license}\``);
}

const output = process.env.GITHUB_OUTPUT;
if (output) {
    appendFileSync(output, `valid=${valid}\n`);
    appendFileSync(output, `report<<PLINKY_EOF\n${lines.join("\n")}\nPLINKY_EOF\n`);
}
console.log(`valid=${valid} steps=${steps}`);
