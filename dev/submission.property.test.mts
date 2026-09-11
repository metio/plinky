// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkSubmission } from "./submission.mjs";

// Issue bodies that reach for the file-command syntax far more often than random text.
const body = fc
    .array(
        fc.oneof(
            fc.string(),
            fc.constantFrom(
                "\n",
                "\r\n",
                "\r",
                " ",
                "### License\n",
                "### MusicXML\n",
                "CC0-1.0",
                "PLINKY_EOF",
                "valid=true",
                "valid<<",
                "report<<PLINKY_EOF",
                "report=",
                "<<",
                "=",
                "`",
                '"',
                "<score-partwise>",
                "_No response_",
            ),
        ),
        { maxLength: 40 },
    )
    .map((parts) => parts.join(""));

describe("submission outputs (properties)", () => {
    it("any issue body yields exactly two one-line outputs, valid and report", async () => {
        await fc.assert(
            fc.asyncProperty(
                body,
                fc.record({ ok: fc.boolean(), count: fc.nat({ max: 10_000 }) }),
                async (text, rendered) => {
                    const file = await checkSubmission(text, async () => rendered);
                    const match = file.match(/^valid=(true|false)\nreport=([^\r\n]*)\n$/);
                    expect(match, file).not.toBeNull();
                    expect(typeof JSON.parse(match?.[2] ?? "")).toBe("string");
                },
            ),
            { numRuns: 500 },
        );
    });
});
