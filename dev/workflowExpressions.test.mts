// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type Step = { name?: string; uses?: string; run?: unknown; with?: Record<string, unknown> };
type Job = { permissions?: Record<string, string>; steps?: Step[] };
type Workflow = { permissions?: unknown; jobs?: Record<string, Job> };

const DIR = new URL("../.github/workflows/", import.meta.url);
const FILES = readdirSync(DIR).filter((file) => /\.ya?ml$/.test(file));
const read = (file: string) => parse(readFileSync(new URL(file, DIR), "utf8")) as Workflow;

// Every shell and github-script body in a workflow, named for the failure message.
function scriptBodies(file: string) {
    const bodies: { where: string; body: string }[] = [];
    for (const [name, job] of Object.entries(read(file).jobs ?? {})) {
        for (const [index, step] of (job.steps ?? []).entries()) {
            const where = `${file} › ${name} › ${step.name ?? step.uses ?? `step ${index}`}`;
            if (typeof step.run === "string") {
                bodies.push({ where, body: step.run });
            }
            if (typeof step.with?.script === "string") {
                bodies.push({ where, body: step.with.script });
            }
        }
    }
    return bodies;
}

// A `${{ }}` expansion is pasted into the script's source before it runs, so a value that
// carries quotes or newlines becomes code. Values reach a script through `env:` instead.
describe("workflow script bodies", () => {
    it("finds the workflows", () => {
        expect(FILES).toContain("score-submission.yml");
    });

    it.each(FILES)("%s pastes no expression into a run or script body", (file) => {
        const pasted = scriptBodies(file)
            .filter(({ body }) => body.includes("${{"))
            .map(({ where }) => where);
        expect(pasted).toEqual([]);
    });
});

describe("the score-submission workflow", () => {
    const workflow = read("score-submission.yml");

    it("grants nothing by default", () => {
        expect(workflow.permissions).toEqual({});
    });

    it("reads the issue body only in a job that cannot write", () => {
        const check = workflow.jobs?.check;
        expect(check?.permissions).toEqual({ contents: "read" });
        const checkout = check?.steps?.find((step) => step.uses?.startsWith("actions/checkout@"));
        expect(checkout?.with?.["persist-credentials"]).toBe(false);
        const readers = Object.entries(workflow.jobs ?? {})
            .filter(([, job]) => JSON.stringify(job).includes("github.event.issue.body"))
            .map(([name]) => name);
        expect(readers).toEqual(["check"]);
    });

    it("saves no dependency cache from an issue anyone can open", () => {
        const setup = workflow.jobs?.check?.steps?.find((step) =>
            step.uses?.startsWith("actions/setup-node@"),
        );
        expect(setup?.with?.cache).toBeUndefined();
    });
});
