// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkSubmission } from "./submission.mjs";

const SCRIPT = fileURLToPath(
    new URL("../.github/scripts/validate-submission.mjs", import.meta.url),
);
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const form = (fields: Record<string, string>) =>
    Object.entries(fields)
        .map(([label, value]) => `### ${label}\n\n${value}`)
        .join("\n\n");

// Reads a GITHUB_OUTPUT text, asserting it holds exactly the two one-line outputs.
function readOutputs(text: string) {
    const match = text.match(/^valid=(true|false)\nreport=([^\r\n]*)\n$/);
    expect(match, text).not.toBeNull();
    return { valid: match?.[1], report: JSON.parse(match?.[2] ?? "") as unknown };
}

// Runs the real validator as the workflow does. An empty MusicXML section keeps it from
// launching a browser.
function runValidator(body: string) {
    const dir = mkdtempSync(join(tmpdir(), "plinky-submission-"));
    const output = join(dir, "output");
    writeFileSync(output, "");
    const run = spawnSync(process.execPath, [SCRIPT], {
        cwd: ROOT,
        env: { PATH: process.env.PATH, ISSUE_BODY: body, GITHUB_OUTPUT: output },
        encoding: "utf8",
    });
    expect(run.status, run.stderr).toBe(0);
    return readOutputs(readFileSync(output, "utf8"));
}

const HOSTILE = form({
    "Score title": "x",
    MusicXML: "_No response_",
    License: [
        "CC0-1.0",
        "PLINKY_EOF",
        'valid="; await github.rest.issues.update({owner:context.repo.owner,repo:context.repo.repo,issue_number:1,state:"closed"}); //',
        "z<<PLINKY_EOF",
        "y",
    ].join("\n"),
});

describe("the submission validator's outputs", () => {
    it("cannot be extended by a hostile issue body", () => {
        const outputs = runValidator(HOSTILE);
        expect(outputs.valid).toBe("false");
        expect(outputs.report).not.toContain("github.rest");
    });

    it("reports an honest body that fails the check", () => {
        const outputs = runValidator(
            form({ "Score title": "Ode", MusicXML: "_No response_", License: "CC-BY-4.0" }),
        );
        expect(outputs.valid).toBe("false");
        expect(outputs.report).toContain("No MusicXML was provided.");
        expect(outputs.report).toContain("License: `CC-BY-4.0`");
    });
});

// A render stand-in that records the MusicXML it was given.
function rendering(result: { ok: boolean; count: number }) {
    const seen: string[] = [];
    const render = async (xml: string) => {
        seen.push(xml);
        return result;
    };
    return { seen, render };
}

const check = async (fields: Record<string, string>, result = { ok: true, count: 1 }) => {
    const { seen, render } = rendering(result);
    return { ...readOutputs(await checkSubmission(form(fields), render)), seen };
};

describe("checkSubmission", () => {
    it("renders the fenced MusicXML and passes a good score under a listed licence", async () => {
        const outputs = await check({
            MusicXML: "```xml\n<score-partwise/>\n```",
            License: "CC0-1.0",
        });
        expect(outputs.seen).toEqual(["<score-partwise/>"]);
        expect(outputs.valid).toBe("true");
        expect(outputs.report).toBe(
            "✅ **Looks good!** This renders and plays 1 note in Plinky. A maintainer will review it and add it to the catalog.\n\nLicense: `CC0-1.0`",
        );
    });

    it("counts several notes in the plural", async () => {
        const outputs = await check(
            { MusicXML: "<score-timewise>", License: "CC-BY-SA-4.0" },
            { ok: true, count: 12 },
        );
        expect(outputs.valid).toBe("true");
        expect(outputs.report).toContain("plays 12 notes");
    });

    it("renders nothing for a missing score or a document that is not one", async () => {
        const empty = await check({ MusicXML: "_No response_", License: "CC0-1.0" });
        expect(empty.seen).toEqual([]);
        expect(empty.report).toContain("No MusicXML was provided.");
        const html = await check({ MusicXML: "<html>", License: "CC0-1.0" });
        expect(html.seen).toEqual([]);
        expect(html.valid).toBe("false");
        expect(html.report).toContain("it should be a `<score-partwise>` document");
        expect((await check({})).report).toContain("No MusicXML was provided.");
    });

    it("names a score that fails to render or has no playable notes", async () => {
        const broken = await check(
            { MusicXML: "<score-partwise>", License: "CC0-1.0" },
            { ok: false, count: 0 },
        );
        expect(broken.valid).toBe("false");
        expect(broken.report).toContain("couldn't render this MusicXML");
        const silent = await check(
            { MusicXML: "<score-partwise>", License: "CC0-1.0" },
            { ok: true, count: 0 },
        );
        expect(silent.valid).toBe("false");
        expect(silent.report).toContain("no playable notes");
    });

    it("rejects any licence but the form's options, and leaves it out of the report", async () => {
        for (const License of ["", "CC-BY-NC-4.0", "CC0-1.0\nPLINKY_EOF", "cc0-1.0", "evil`"]) {
            const outputs = await check({ MusicXML: "<score-partwise>", License });
            expect(outputs.valid).toBe("false");
            expect(outputs.report).toBe(
                "⚠️ **This needs a change before it can be added:**\n- The license must be one of `CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`.",
            );
        }
    });

    it("lists every problem at once", async () => {
        const outputs = await check({ MusicXML: "<html>", License: "MIT" });
        expect(outputs.report).toBe(
            "⚠️ **This needs a change before it can be added:**\n- That doesn't look like MusicXML — it should be a `<score-partwise>` document.\n- The license must be one of `CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`.",
        );
    });
});
