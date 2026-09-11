// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Validates a score-submission issue: reads the MusicXML from the form body and
// renders it with the same OpenSheetMusicDisplay the app uses (in headless
// Chromium), confirming it loads and produces playable notes — i.e. that Plinky
// can actually use it. Writes `valid` and a markdown `report` to GITHUB_OUTPUT.
//
// The body is untrusted; dev/submission.mjs keeps every word of it out of the outputs.
import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { chromium } from "playwright";
import {
    checkLicense,
    formatFileCommand,
    licenseProblem,
    readSubmission,
    renderReport,
    submissionOutputs,
    xmlProblem,
} from "../../dev/submission.mjs";

const { xml, license } = readSubmission(process.env.ISSUE_BODY || "");

const problems = [];
let notes = 0;
const unreadable = xmlProblem(xml);
if (unreadable !== null) {
    problems.push(unreadable);
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
const unlicensed = licenseProblem(license);
if (unlicensed !== null) {
    problems.push(unlicensed);
}

const valid = problems.length === 0;
const outputs = submissionOutputs({
    valid,
    report: renderReport({ problems, notes, license: checkLicense(license) }),
});

const output = process.env.GITHUB_OUTPUT;
if (output) {
    appendFileSync(output, formatFileCommand(outputs, `PLINKY_${randomUUID()}`));
}
console.log(`valid=${outputs.valid} notes=${notes}`);
