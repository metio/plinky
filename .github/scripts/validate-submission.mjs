// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Validates a score-submission issue: reads the MusicXML from the form body and
// renders it with the same OpenSheetMusicDisplay the app uses (in headless
// Chromium), confirming it loads and produces playable notes — i.e. that Plinky
// can actually use it. Writes `valid` and a markdown `report` to GITHUB_OUTPUT.
import { appendFileSync } from "node:fs";
import { chromium } from "playwright";

const body = process.env.ISSUE_BODY || "";

// Read a field from the issue form's rendered body.
const section = (label) => {
    const re = new RegExp(`###\\s*${label}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n###\\s|$)`, "i");
    const match = body.match(re);
    return match ? match[1].trim() : "";
};

// The MusicXML field uses render:xml, so it arrives wrapped in a fenced block.
let xml = section("MusicXML");
const fenced = xml.match(/^```[a-z]*\r?\n([\s\S]*?)\r?\n```$/);
if (fenced) {
    xml = fenced[1].trim();
}
const license = section("License");

const problems = [];
let notes = 0;
if (!xml || xml === "_No response_") {
    problems.push("No MusicXML was provided.");
} else if (!/<score-partwise|<score-timewise/i.test(xml)) {
    problems.push("That doesn't look like MusicXML — it should be a `<score-partwise>` document.");
} else {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.addScriptTag({
            path: "node_modules/opensheetmusicdisplay/build/opensheetmusicdisplay.min.js",
        });
        const result = await page.evaluate(async (source) => {
            const element = document.createElement("div");
            element.style.width = "1000px";
            document.body.appendChild(element);
            const osmd = new window.opensheetmusicdisplay.OpenSheetMusicDisplay(element, {
                autoResize: false,
                drawingParameters: "compact",
            });
            try {
                await osmd.load(source);
                osmd.render();
            } catch (error) {
                return { ok: false, count: 0 };
            }
            // Count playable positions the way the practice matcher does: every
            // cursor step that has at least one sounding (non-rest) pitch.
            let count = 0;
            const cursor = osmd.cursor;
            cursor.reset();
            while (!cursor.iterator.EndReached) {
                const pitched = cursor
                    .NotesUnderCursor()
                    .filter((note) => !note.isRest() && note.halfTone > 0);
                if (pitched.length > 0) {
                    count++;
                }
                cursor.next();
            }
            return { ok: true, count };
        }, xml);
        if (!result.ok) {
            problems.push("Plinky couldn't render this MusicXML — please check that it is valid.");
        } else {
            notes = result.count;
            if (notes === 0) {
                problems.push("The score has no playable notes — Plinky could not use it.");
            }
        }
    } finally {
        await browser.close();
    }
}

const valid = problems.length === 0;
const lines = [
    valid
        ? `✅ **Looks good!** This renders and plays ${notes} note${notes === 1 ? "" : "s"} in Plinky. A maintainer will review it and add it to the catalog.`
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
console.log(`valid=${valid} notes=${notes}`);
