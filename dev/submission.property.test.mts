// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { randomUUID } from "node:crypto";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    checkLicense,
    formatFileCommand,
    licenseProblem,
    parseFileCommand,
    readSubmission,
    renderReport,
    submissionOutputs,
    xmlProblem,
} from "./submission.mjs";

// Issue bodies that reach for the file-command syntax far more often than random text.
const body = fc
    .array(
        fc.oneof(
            fc.string(),
            fc.constantFrom(
                "\n",
                "\r\n",
                "### License\n",
                "### MusicXML\n",
                "CC0-1.0",
                "PLINKY_EOF",
                "valid=true",
                "valid<<",
                "report<<PLINKY_EOF",
                "<<",
                "=",
                "`",
                "<score-partwise>",
                "_No response_",
            ),
        ),
        { maxLength: 40 },
    )
    .map((parts) => parts.join(""));

// The validator's pipeline with the rendering stood in for by an arbitrary result.
function outputsFor(text: string, rendered: { ok: boolean; notes: number }) {
    const { xml, license } = readSubmission(text);
    const problems = [xmlProblem(xml), licenseProblem(license)].filter(
        (problem): problem is string => problem !== null,
    );
    if (problems.length === 0 && !rendered.ok) {
        problems.push("render failed");
    }
    const outputs = submissionOutputs({
        valid: problems.length === 0,
        report: renderReport({ problems, notes: rendered.notes, license: checkLicense(license) }),
    });
    return { outputs, text: formatFileCommand(outputs, `PLINKY_${randomUUID()}`) };
}

describe("submission outputs (properties)", () => {
    it("any issue body yields exactly valid and report, with valid spelled true or false", () => {
        fc.assert(
            fc.property(
                body,
                fc.record({ ok: fc.boolean(), notes: fc.nat({ max: 10_000 }) }),
                (text, rendered) => {
                    const { outputs, text: file } = outputsFor(text, rendered);
                    const entries = parseFileCommand(file);
                    expect(entries.map(([key]) => key)).toEqual(["valid", "report"]);
                    expect(["true", "false"]).toContain(entries[0]?.[1]);
                    expect(Object.fromEntries(entries)).toEqual(outputs);
                },
            ),
            { numRuns: 500 },
        );
    });

    it("the runner reads back exactly what was written", () => {
        const value = fc
            .array(fc.oneof(fc.string(), fc.constantFrom("\n", "\r\n", "\r", "<<", "=")), {
                maxLength: 20,
            })
            .map((parts) => parts.join(""))
            .filter((text) => !text.endsWith("\r"));
        const outputs = fc.dictionary(fc.stringMatching(/^[A-Za-z_][A-Za-z0-9_-]{0,8}$/), value);
        fc.assert(
            fc.property(outputs, (written) => {
                const file = formatFileCommand(written, `PLINKY_${randomUUID()}`);
                expect(parseFileCommand(file)).toEqual(Object.entries(written));
            }),
        );
    });
});
