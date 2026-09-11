// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pure half of the score-submission check (.github/scripts/validate-submission.mjs):
// reading the issue form's body, wording the report, and writing the step outputs.
//
// The issue body is untrusted text from anyone on GitHub, and the form's dropdowns are
// not enforced — an issue opened through the API or edited afterwards can say anything
// in any section. So nothing from the body reaches the outputs: the report is built from
// fixed sentences, a count and a licence matched against the form's own options, and
// `valid` is the validation's verdict spelled "true" or "false".

// The form's licence options (.github/ISSUE_TEMPLATE/score-submission.yml).
export const LICENSES = ["CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0"];

// A field from the form's rendered body: the text under its `### <label>` heading.
export function section(body, label) {
    const re = new RegExp(`###\\s*${label}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n###\\s|$)`, "i");
    const match = body.match(re);
    return match ? match[1].trim() : "";
}

// The MusicXML (unwrapped from the fenced block render:xml puts it in) and the raw licence.
export function readSubmission(body) {
    let xml = section(body, "MusicXML");
    const fenced = xml.match(/^```[a-z]*\r?\n([\s\S]*?)\r?\n```$/);
    if (fenced) {
        xml = fenced[1].trim();
    }
    return { xml, license: section(body, "License") };
}

// The form option the submitter chose, or null when the section names none of them.
export function checkLicense(raw) {
    return LICENSES.includes(raw) ? raw : null;
}

// Why the MusicXML cannot be rendered at all, or null when it is worth rendering.
export function xmlProblem(xml) {
    if (!xml || xml === "_No response_") {
        return "No MusicXML was provided.";
    }
    if (!/<score-partwise|<score-timewise/i.test(xml)) {
        return "That doesn't look like MusicXML — it should be a `<score-partwise>` document.";
    }
    return null;
}

// Why the licence cannot be accepted, or null when it is one of the form's options.
export function licenseProblem(license) {
    return checkLicense(license) === null
        ? `The license must be one of ${LICENSES.map((option) => `\`${option}\``).join(", ")}.`
        : null;
}

// The markdown comment. `license` must already have passed checkLicense.
export function renderReport({ problems, notes, license }) {
    const lines = [
        problems.length === 0
            ? `✅ **Looks good!** This renders and plays ${notes} note${notes === 1 ? "" : "s"} in Plinky. A maintainer will review it and add it to the catalog.`
            : `⚠️ **This needs a change before it can be added:**\n${problems.map((problem) => `- ${problem}`).join("\n")}`,
    ];
    if (license !== null && checkLicense(license) !== null) {
        lines.push(`\nLicense: \`${license}\``);
    }
    return lines.join("\n");
}

// The step outputs. `valid` is derived from the verdict alone, and only a real `true`
// reads as valid.
export function submissionOutputs({ valid, report }) {
    return { valid: valid === true ? "true" : "false", report };
}

const LINE_BREAK = /\r?\n/;

// A GITHUB_OUTPUT file command writing every output as a `key<<DELIMITER` block. The
// delimiter must be unguessable (a fresh UUID per run): the runner ends a block at the
// first line equal to it, so a value that could contain it could close its block early
// and define further outputs of its own.
export function formatFileCommand(outputs, delimiter) {
    if (!delimiter || LINE_BREAK.test(delimiter) || delimiter.includes("<<")) {
        throw new Error(`unusable delimiter ${JSON.stringify(delimiter)}`);
    }
    let text = "";
    for (const [key, value] of Object.entries(outputs)) {
        if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key)) {
            throw new Error(`unusable output name ${JSON.stringify(key)}`);
        }
        if (value.split(LINE_BREAK).includes(delimiter)) {
            throw new Error(`output ${key} contains its own delimiter`);
        }
        // The runner reads "\r\n" as one line break, so a trailing "\r" would be lost.
        if (value.endsWith("\r")) {
            throw new Error(`output ${key} ends in a carriage return`);
        }
        text += `${key}<<${delimiter}\n${value}\n${delimiter}\n`;
    }
    return text;
}

// One line of a file command and the break that ended it, the way the runner splits them.
function readLine(text, cursor) {
    if (cursor.index >= text.length) {
        return null;
    }
    const start = cursor.index;
    const lf = text.indexOf("\n", start);
    if (lf < 0) {
        cursor.index = text.length;
        return { line: text.slice(start), end: "" };
    }
    const crlf = lf > start && text[lf - 1] === "\r";
    cursor.index = lf + 1;
    return crlf
        ? { line: text.slice(start, lf - 1), end: "\r\n" }
        : { line: text.slice(start, lf), end: "\n" };
}

// Reads a GITHUB_OUTPUT file the way the Actions runner does (FileCommandManager): blank
// lines skipped, `key=value` when an `=` comes before any `<<`, otherwise a `key<<DELIM`
// block running to the first line equal to DELIM. Returns every assignment in order; the
// runner applies them in turn, so a repeated key takes its last value.
export function parseFileCommand(text) {
    const entries = [];
    const cursor = { index: 0 };
    for (let read = readLine(text, cursor); read !== null; read = readLine(text, cursor)) {
        const { line } = read;
        if (line === "") {
            continue;
        }
        const equals = line.indexOf("=");
        const heredoc = line.indexOf("<<");
        if (equals >= 0 && (heredoc < 0 || equals < heredoc)) {
            const key = line.slice(0, equals);
            if (key === "") {
                throw new Error(`invalid file command line ${JSON.stringify(line)}`);
            }
            entries.push([key, line.slice(equals + 1)]);
        } else if (heredoc >= 0) {
            const key = line.slice(0, heredoc);
            const delimiter = line.slice(heredoc + 2);
            if (key === "" || delimiter === "") {
                throw new Error(`invalid file command line ${JSON.stringify(line)}`);
            }
            let value = "";
            let pending = "";
            for (;;) {
                const inner = readLine(text, cursor);
                if (inner === null) {
                    throw new Error(`matching delimiter not found: ${delimiter}`);
                }
                if (inner.line === delimiter) {
                    break;
                }
                value += pending + inner.line;
                pending = inner.end;
            }
            entries.push([key, value]);
        } else {
            throw new Error(`invalid file command line ${JSON.stringify(line)}`);
        }
    }
    return entries;
}
