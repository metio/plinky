// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_NAME_LENGTH } from "./assignment";
import {
    type AssignmentReport,
    collectReports,
    decodeReport,
    encodeReport,
    groupReports,
    MAX_REPORT_ID_LENGTH,
    MAX_REPORT_ITEMS,
    MAX_WHO_LENGTH,
    NOT_PLAYED,
    reportSummary,
} from "./assignmentReport";
import { packToCode } from "./shareCode";

// A score as the format carries it: the played range, plus the sentinel that has to
// survive the trip as itself rather than being clamped into "played terribly".
const score = fc.oneof(fc.integer({ min: 0, max: 100 }), fc.constant(NOT_PLAYED));

// Piece ids over a tiny alphabet so duplicates and overlaps between reports are
// common rather than astronomically rare.
const pieceId = fc.constantFrom("a", "b", "c", "d");

const reportOf = fc.record({
    assignmentId: fc.string({ maxLength: 20 }),
    assignmentName: fc.string({ maxLength: 20 }),
    who: fc.string({ maxLength: 20 }),
    items: fc.array(fc.record({ id: pieceId, score }), { minLength: 1, maxLength: 12 }),
    at: fc.nat({ max: 2_000_000_000_000 }),
}) satisfies fc.Arbitrary<AssignmentReport>;

describe("report codec properties", () => {
    it("recovers a report through encode → decode", () => {
        fc.assert(
            fc.property(reportOf, (report) => {
                expect(decodeReport(encodeReport(report))).toEqual(report);
            }),
        );
    });

    it("returns null rather than throwing on an arbitrary code", () => {
        fc.assert(
            fc.property(fc.string(), (code) => {
                expect(() => decodeReport(code)).not.toThrow();
            }),
        );
    });

    it("holds every cap however long the encoded strings were", () => {
        // Built through packToCode rather than encodeReport, so the payload is one no
        // honest device would produce — which is the case the caps exist for.
        const long = fc.string({ minLength: 1, maxLength: 400 });
        fc.assert(
            fc.property(
                long,
                long,
                long,
                fc.array(fc.tuple(long, score), { minLength: 1, maxLength: 40 }),
                (assignmentId, assignmentName, who, items) => {
                    const decoded = decodeReport(
                        packToCode({ a: assignmentId, n: assignmentName, w: who, i: items, t: 0 }),
                    );
                    expect(decoded).not.toBeNull();
                    expect(decoded?.assignmentId.length).toBeLessThanOrEqual(MAX_REPORT_ID_LENGTH);
                    expect(decoded?.assignmentName.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
                    expect(decoded?.who.length).toBeLessThanOrEqual(MAX_WHO_LENGTH);
                    expect(decoded?.items.length).toBeLessThanOrEqual(MAX_REPORT_ITEMS);
                    for (const item of decoded?.items ?? []) {
                        expect(item.id.length).toBeLessThanOrEqual(MAX_REPORT_ID_LENGTH);
                    }
                },
            ),
        );
    });

    it("caps the item list however many items were encoded", () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 40 }), (extra) => {
                const items = Array.from({ length: MAX_REPORT_ITEMS + extra }, (_, at) => [
                    `p${at}`,
                    0,
                ]);
                const decoded = decodeReport(
                    packToCode({ a: "set", n: "", w: "", i: items, t: 0 }),
                );
                expect(decoded?.items.length).toBe(MAX_REPORT_ITEMS);
            }),
        );
    });

    it("summarises within bounds for any report", () => {
        fc.assert(
            fc.property(reportOf, (report) => {
                const { played, total, average } = reportSummary(report);
                expect(total).toBe(report.items.length);
                expect(played).toBeGreaterThanOrEqual(0);
                expect(played).toBeLessThanOrEqual(total);
                expect(average).toBeGreaterThanOrEqual(0);
                expect(average).toBeLessThanOrEqual(100);
            }),
        );
    });
});

describe("collecting and grouping properties", () => {
    // A paste is whitespace-separated codes, which is what collectReports splits on.
    const paste = (reports: AssignmentReport[]) => reports.map(encodeReport).join("\n");

    it("keeps one report per person per assignment, whatever was pasted", () => {
        fc.assert(
            fc.property(fc.array(reportOf, { maxLength: 12 }), (reports) => {
                const collected = collectReports(paste(reports));
                const keys = collected.map((report) =>
                    JSON.stringify([report.assignmentId, report.who.toLowerCase()]),
                );
                expect(new Set(keys).size).toBe(keys.length);
            }),
        );
    });

    it("groups every collected report exactly once", () => {
        fc.assert(
            fc.property(fc.array(reportOf, { maxLength: 12 }), (reports) => {
                const collected = collectReports(paste(reports));
                const groups = groupReports(collected);
                const flattened = groups.flatMap((group) => group.reports);
                // A partition: every report lands in exactly one group and none is
                // invented. The sequence legitimately differs — grouping gathers two
                // interleaved assignments — so it is the contents that must match.
                const sorted = (list: AssignmentReport[]) =>
                    list.map((report) => JSON.stringify(report)).sort();
                expect(sorted(flattened)).toEqual(sorted(collected));
                // One group per distinct assignment, and nothing shared between them.
                const ids = groups.map((group) => group.assignmentId);
                expect(new Set(ids).size).toBe(ids.length);
                for (const group of groups) {
                    expect(group.reports.every((r) => r.assignmentId === group.assignmentId)).toBe(
                        true,
                    );
                }
            }),
        );
    });

    it("gives every group columns that cover its own widest report", () => {
        fc.assert(
            fc.property(fc.array(reportOf, { maxLength: 12 }), (reports) => {
                for (const group of groupReports(collectReports(paste(reports)))) {
                    const widest = Math.max(...group.reports.map((r) => r.items.length));
                    expect(group.columns.length).toBe(widest);
                    // Every column belongs to this group: a piece nobody here was asked
                    // to play must never become a blank they all appear to have skipped.
                    const asked = new Set(group.reports.flatMap((r) => r.items.map((i) => i.id)));
                    expect(group.columns.every((id) => asked.has(id))).toBe(true);
                }
            }),
        );
    });
});
