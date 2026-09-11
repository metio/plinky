// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Validates a score-submission issue: reads the MusicXML from the form body and
// renders it with the same OpenSheetMusicDisplay the app uses (in headless
// Chromium), confirming it loads and produces playable notes — i.e. that Plinky
// can actually use it. Writes `valid` and a JSON-encoded markdown `report` to
// GITHUB_OUTPUT.
//
// The body is untrusted; dev/submission.mjs keeps every word of it out of the outputs.
import { appendFileSync } from "node:fs";
import { chromium } from "playwright";
import { checkSubmission } from "../../dev/submission.mjs";

async function render(xml) {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.addScriptTag({
            path: "node_modules/opensheetmusicdisplay/build/opensheetmusicdisplay.min.js",
        });
        return await page.evaluate(async (source) => {
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
    } finally {
        await browser.close();
    }
}

const outputs = await checkSubmission(process.env.ISSUE_BODY || "", render);
const output = process.env.GITHUB_OUTPUT;
if (output) {
    appendFileSync(output, outputs);
}
console.log(outputs);
