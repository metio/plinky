// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The score-submission check (.github/scripts/validate-submission.mjs) without the
// browser: reading the issue form's body, judging it, and writing the step outputs.
//
// The issue body is untrusted text from anyone on GitHub, and the form's dropdowns are
// not enforced — an issue opened through the API or edited afterwards can say anything
// in any section. So nothing from the body reaches the outputs: the report is built from
// fixed sentences, a count and a licence matched against the form's own options, and
// `valid` is the verdict spelled "true" or "false".

// The form's licence options, pinned to .github/ISSUE_TEMPLATE/score-submission.yml by
// dev/submission.test.mts.
export const LICENSES = ["CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0"];

// A field from the form's rendered body: the text under its `### <label>` heading.
function section(body, label) {
    const re = new RegExp(`###\\s*${label}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n###\\s|$)`, "i");
    const match = body.match(re);
    return match ? match[1].trim() : "";
}

// Why the MusicXML cannot be rendered at all, or null when it is worth rendering.
function xmlProblem(xml) {
    if (!xml || xml === "_No response_") {
        return "No MusicXML was provided.";
    }
    if (!/<score-partwise|<score-timewise/i.test(xml)) {
        return "That doesn't look like MusicXML — it should be a `<score-partwise>` document.";
    }
    return null;
}

// Judges an issue body and returns the GITHUB_OUTPUT text for it. `render` receives the
// MusicXML (unwrapped from the fenced block render:xml puts it in) and resolves to
// `{ ok, count }`, the number of playable positions it found.
//
// Each output is one `key=value` line: the runner reads such a line whole, and
// JSON.stringify escapes every line break in the report, so no value can end a line early
// and start another output of its own.
export async function checkSubmission(body, render) {
    let xml = section(body, "MusicXML");
    const fenced = xml.match(/^```[a-z]*\r?\n([\s\S]*?)\r?\n```$/);
    if (fenced) {
        xml = fenced[1].trim();
    }
    const license = section(body, "License");

    const problems = [];
    let notes = 0;
    const unreadable = xmlProblem(xml);
    if (unreadable !== null) {
        problems.push(unreadable);
    } else {
        const result = await render(xml);
        if (!result.ok) {
            problems.push("Plinky couldn't render this MusicXML — please check that it is valid.");
        } else {
            notes = result.count;
            if (notes === 0) {
                problems.push("The score has no playable notes — Plinky could not use it.");
            }
        }
    }
    const licensed = LICENSES.includes(license);
    if (!licensed) {
        problems.push(
            `The license must be one of ${LICENSES.map((option) => `\`${option}\``).join(", ")}.`,
        );
    }

    const lines = [
        problems.length === 0
            ? `✅ **Looks good!** This renders and plays ${notes} note${notes === 1 ? "" : "s"} in Plinky. A maintainer will review it and add it to the catalog.`
            : `⚠️ **This needs a change before it can be added:**\n${problems.map((problem) => `- ${problem}`).join("\n")}`,
    ];
    if (licensed) {
        lines.push(`\nLicense: \`${license}\``);
    }
    const report = lines.join("\n");
    return `valid=${problems.length === 0}\nreport=${JSON.stringify(report)}\n`;
}
