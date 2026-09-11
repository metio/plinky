// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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

const SCRIPT = fileURLToPath(
    new URL("../.github/scripts/validate-submission.mjs", import.meta.url),
);
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const form = (fields: Record<string, string>) =>
    Object.entries(fields)
        .map(([label, value]) => `### ${label}\n\n${value}`)
        .join("\n\n");

// Runs the real validator as the workflow does and reads its outputs as the runner would.
// An empty MusicXML section keeps it from launching a browser.
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
    return parseFileCommand(readFileSync(output, "utf8"));
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
        const entries = runValidator(HOSTILE);
        expect(entries.map(([key]) => key)).toEqual(["valid", "report"]);
        expect(Object.fromEntries(entries).valid).toBe("false");
        expect(Object.fromEntries(entries).report).not.toContain("github.rest");
    });

    it("reports an honest body that fails the check", () => {
        const entries = runValidator(
            form({ "Score title": "Ode", MusicXML: "_No response_", License: "CC-BY-4.0" }),
        );
        const outputs = Object.fromEntries(entries);
        expect(entries.map(([key]) => key)).toEqual(["valid", "report"]);
        expect(outputs.valid).toBe("false");
        expect(outputs.report).toContain("No MusicXML was provided.");
        expect(outputs.report).toContain("License: `CC-BY-4.0`");
    });
});

describe("readSubmission", () => {
    it("unwraps the fenced MusicXML and reads the licence", () => {
        const body = form({
            MusicXML: "```xml\n<score-partwise/>\n```",
            License: "CC0-1.0",
        });
        expect(readSubmission(body)).toEqual({ xml: "<score-partwise/>", license: "CC0-1.0" });
    });

    it("reads a missing section as empty", () => {
        expect(readSubmission("")).toEqual({ xml: "", license: "" });
    });
});

describe("checkLicense", () => {
    it("accepts exactly the form's options", () => {
        expect(checkLicense("CC0-1.0")).toBe("CC0-1.0");
        expect(checkLicense("CC-BY-SA-4.0")).toBe("CC-BY-SA-4.0");
    });

    it("rejects anything else, including an option with more after it", () => {
        expect(checkLicense("")).toBeNull();
        expect(checkLicense("CC-BY-NC-4.0")).toBeNull();
        expect(checkLicense("CC0-1.0\nPLINKY_EOF")).toBeNull();
        expect(checkLicense("cc0-1.0")).toBeNull();
    });
});

describe("xmlProblem", () => {
    it("passes a MusicXML document on to be rendered", () => {
        expect(xmlProblem("<score-partwise>")).toBeNull();
        expect(xmlProblem("<score-timewise>")).toBeNull();
    });

    it("names a missing score and a document that is not one", () => {
        expect(xmlProblem("")).toBe("No MusicXML was provided.");
        expect(xmlProblem("_No response_")).toBe("No MusicXML was provided.");
        expect(xmlProblem("<html>")).toContain("MusicXML");
    });
});

describe("licenseProblem", () => {
    it("accepts a listed licence and names every option otherwise", () => {
        expect(licenseProblem("CC-BY-4.0")).toBeNull();
        expect(licenseProblem("MIT")).toBe(
            "The license must be one of `CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`.",
        );
    });
});

describe("renderReport", () => {
    it("counts the notes and names the licence when there are no problems", () => {
        expect(renderReport({ problems: [], notes: 1, license: "CC0-1.0" })).toBe(
            "✅ **Looks good!** This renders and plays 1 note in Plinky. A maintainer will review it and add it to the catalog.\n\nLicense: `CC0-1.0`",
        );
    });

    it("lists the problems and leaves out a licence that is not an option", () => {
        const report = renderReport({ problems: ["A", "B"], notes: 0, license: "evil`" });
        expect(report).toBe("⚠️ **This needs a change before it can be added:**\n- A\n- B");
    });
});

describe("submissionOutputs", () => {
    it("spells the verdict true only for a real true", () => {
        expect(submissionOutputs({ valid: true, report: "" }).valid).toBe("true");
        expect(submissionOutputs({ valid: false, report: "" }).valid).toBe("false");
        expect(submissionOutputs({ valid: "true", report: "" }).valid).toBe("false");
        expect(submissionOutputs({ valid: 1, report: "" }).valid).toBe("false");
    });
});

describe("formatFileCommand", () => {
    it("writes each output as a block the runner reads back", () => {
        const text = formatFileCommand({ valid: "true", report: "a\nb" }, "D");
        expect(text).toBe("valid<<D\ntrue\nD\nreport<<D\na\nb\nD\n");
        expect(parseFileCommand(text)).toEqual([
            ["valid", "true"],
            ["report", "a\nb"],
        ]);
    });

    it("refuses a value that contains its delimiter as a line", () => {
        expect(() => formatFileCommand({ report: "x\nD\nvalid=1" }, "D")).toThrow(/delimiter/);
        expect(() => formatFileCommand({ report: "x\nD\r\nvalid=1" }, "D")).toThrow(/delimiter/);
    });

    it("refuses a delimiter or a name the runner would misread", () => {
        expect(() => formatFileCommand({ a: "" }, "")).toThrow();
        expect(() => formatFileCommand({ a: "" }, "a\nb")).toThrow();
        expect(() => formatFileCommand({ "a=b": "" }, "D")).toThrow();
        expect(() => formatFileCommand({ "a<<b": "" }, "D")).toThrow();
    });

    it("refuses a trailing carriage return the runner would drop", () => {
        expect(() => formatFileCommand({ a: "x\r" }, "D")).toThrow(/carriage/);
    });
});

describe("parseFileCommand", () => {
    it("reads key=value lines and skips blank ones", () => {
        expect(parseFileCommand("a=1\n\nb=x<<y\n")).toEqual([
            ["a", "1"],
            ["b", "x<<y"],
        ]);
    });

    it("keeps every assignment in order, so a repeated key is visible", () => {
        expect(parseFileCommand("a=1\na<<E\n2\nE\n")).toEqual([
            ["a", "1"],
            ["a", "2"],
        ]);
    });

    it("ends a block at a delimiter line terminated by CRLF", () => {
        expect(parseFileCommand("a<<E\r\nx\r\ny\r\nE\r\n")).toEqual([["a", "x\r\ny"]]);
    });

    it("rejects an unterminated block and a line with neither form", () => {
        expect(() => parseFileCommand("a<<E\nx\n")).toThrow(/delimiter/);
        expect(() => parseFileCommand("nonsense\n")).toThrow(/invalid/);
        expect(() => parseFileCommand("=1\n")).toThrow(/invalid/);
    });
});
