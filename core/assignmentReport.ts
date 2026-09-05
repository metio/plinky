// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type Assignment, MAX_ITEMS, MAX_NAME_LENGTH, MAX_ID_LENGTH } from "./assignment";
import { toCsv } from "./csv";
import { letterFor } from "./grade";
import { isRecord } from "./guards";
import { packToCode, unpackFromCode } from "./shareCode";

// Handing an assignment back. Until now the loop ran one way: a teacher builds a
// list, shares it by link, and never learns what happened. Progress lives on the
// student's device and stays there.
//
// A report is that device saying, in one pasteable code, how the list went — a
// practice log that is accurate and machine-readable instead of remembered.
//
// **It is not proof.** The code is written by the same device it describes, so a
// student who wants to can write a better one, exactly as they could write a
// better practice diary. Nothing here changes that, and the copy must not pretend
// otherwise: proving a run happened needs a server that watched it. What this
// removes is the transcription, not the trust.

export type ReportItem = {
    id: string;
    // Best score on this piece, 0–100, or -1 for a piece never played.
    score: number;
};

export type AssignmentReport = {
    assignmentId: string;
    assignmentName: string;
    // What the student typed. Free text: the app has no accounts and no idea who
    // anyone is, so this is a label for the teacher, not an identity.
    who: string;
    items: ReportItem[];
    at: number;
};

export const MAX_WHO_LENGTH = 60;

// Bounds on everything else a code carries. A report is pasted by a teacher who was
// sent it, so these are not a defence against a class — they are what keeps one
// crafted code from filling a table with a thousand columns headed by a kilobyte
// each. MAX_REPORT_ITEMS matches the assignment's own MAX_ITEMS: a report answers a
// list, so it can never honestly be longer than the longest list.
export const MAX_REPORT_ITEMS = MAX_ITEMS;
export const MAX_REPORT_ID_LENGTH = MAX_ID_LENGTH;
// A piece the device has no score for. Distinct from zero, which is a run that
// happened and went badly — a teacher reads those differently.
export const NOT_PLAYED = -1;

// What the device knows about one piece of an assignment.
export type ScoreLookup = (id: string) => number | null;

// Build a report from an assignment and whatever this device scored on its pieces.
// Every step appears, played or not: a list of what was done is only useful next
// to what was not.
export function buildReport(
    assignment: Assignment,
    lookup: ScoreLookup,
    who: string,
    at: number,
): AssignmentReport {
    return {
        // The identity the teacher minted, so every device sent this assignment reports
        // against one id. A set that was never shared has no origin and is only ever
        // reported by the device that wrote it, where the local id is identity enough.
        assignmentId: assignment.origin ?? assignment.id,
        assignmentName: assignment.name ?? "",
        who: who.trim().slice(0, MAX_WHO_LENGTH),
        items: assignment.items.map((item) => {
            const score = lookup(item.id);
            return { id: item.id, score: score === null ? NOT_PLAYED : clampScore(score) };
        }),
        at,
    };
}

// A score off the wire. NOT_PLAYED has to survive the trip intact — clamping it
// into range would turn "never played" into "played terribly", which is the one
// distinction this format exists to carry.
function readScore(value: unknown): number {
    if (typeof value !== "number") {
        return NOT_PLAYED;
    }
    return value === NOT_PLAYED ? NOT_PLAYED : clampScore(value);
}

function clampScore(score: number): number {
    if (!Number.isFinite(score)) {
        return NOT_PLAYED;
    }
    return Math.min(100, Math.max(0, Math.round(score)));
}

// How the whole list went: the share of its pieces played to a passing standard,
// which is the number a teacher actually scans a column for.
export function reportSummary(report: AssignmentReport): {
    played: number;
    total: number;
    average: number;
} {
    const played = report.items.filter((item) => item.score !== NOT_PLAYED);
    const total = report.items.length;
    const average =
        played.length === 0
            ? 0
            : Math.round(played.reduce((sum, item) => sum + item.score, 0) / played.length);
    return { played: played.length, total, average };
}

// The letter a score earns, or null for a piece never played — so a table can show
// a blank rather than an F for something nobody attempted.
export function reportLetter(score: number): string | null {
    return score === NOT_PLAYED ? null : letterFor(score);
}

// Compact for the wire: single-letter keys and item pairs, because this code is
// meant to be pasted into a message rather than clicked.
type Compact = { a: string; n: string; w: string; i: [string, number][]; t: number };

export function encodeReport(report: AssignmentReport): string {
    const compact: Compact = {
        a: report.assignmentId,
        n: report.assignmentName,
        w: report.who,
        i: report.items.map((item) => [item.id, item.score]),
        t: report.at,
    };
    return packToCode(compact);
}

export function decodeReport(code: string): AssignmentReport | null {
    if (!code) {
        return null;
    }
    const raw = unpackFromCode(code.trim());
    if (!isRecord(raw) || typeof raw.a !== "string" || !Array.isArray(raw.i)) {
        return null;
    }
    const items: ReportItem[] = [];
    // Capped on the way in rather than after: the loop is the unbounded work, and a
    // list longer than any assignment could hold is not a report that was cut short,
    // it is one that was written by hand.
    for (const entry of raw.i.slice(0, MAX_REPORT_ITEMS)) {
        if (!Array.isArray(entry) || typeof entry[0] !== "string") {
            continue;
        }
        items.push({ id: entry[0].slice(0, MAX_REPORT_ID_LENGTH), score: readScore(entry[1]) });
    }
    if (items.length === 0) {
        return null;
    }
    return {
        assignmentId: raw.a.slice(0, MAX_REPORT_ID_LENGTH),
        assignmentName: typeof raw.n === "string" ? raw.n.slice(0, MAX_NAME_LENGTH) : "",
        who: typeof raw.w === "string" ? raw.w.slice(0, MAX_WHO_LENGTH) : "",
        items,
        at: typeof raw.t === "number" && Number.isFinite(raw.t) ? raw.t : 0,
    };
}

// Several pasted codes at once: one per line, blank lines and anything unreadable
// ignored, and a second report from the same person for the same assignment
// replacing the first — a teacher collecting a class will paste a resend without
// hunting for the original.
export function collectReports(text: string): AssignmentReport[] {
    const byKey = new Map<string, AssignmentReport>();
    for (const line of text.split(/\s+/)) {
        const report = decodeReport(line);
        if (!report) {
            continue;
        }
        // Keyed structurally rather than by joining the two with a separator: both
        // halves are attacker-chosen strings off the wire, so any character picked to
        // divide them is a character a crafted report can also contain. JSON escaping
        // is injective, so two different pairs cannot produce the same key.
        const key = JSON.stringify([report.assignmentId, report.who.toLowerCase()]);
        const seen = byKey.get(key);
        if (!seen || report.at >= seen.at) {
            byKey.set(key, report);
        }
    }
    return [...byKey.values()];
}

// The pieces a set of reports answers, in the order the fullest of them lists them,
// so a student who skipped the tail still lines up with everyone else.
function reportColumns(reports: AssignmentReport[]): string[] {
    return reports.reduce<string[]>(
        (widest, report) =>
            report.items.length > widest.length ? report.items.map((item) => item.id) : widest,
        [],
    );
}

// One assignment's worth of a paste: the reports that name it, and the pieces they
// answer.
export type ReportGroup = {
    assignmentId: string;
    assignmentName: string;
    columns: string[];
    reports: AssignmentReport[];
};

// A paste split by the assignment each report names.
//
// A teacher collecting a term pastes whatever arrived, and what arrives is several
// assignments at once. Read as one table they cannot be: the columns would be
// whichever set happened to be longest, and every student who did a different one
// would show a dash under every piece — which reads as "did not play" rather than
// "was never asked". One table per assignment is the only honest shape.
//
// Groups keep the order their first report was pasted in, and reports keep theirs
// within a group, so a teacher watching the table build sees it grow downward
// rather than reshuffle.
export function groupReports(reports: AssignmentReport[]): ReportGroup[] {
    const byAssignment = new Map<string, AssignmentReport[]>();
    for (const report of reports) {
        const group = byAssignment.get(report.assignmentId);
        if (group) {
            group.push(report);
        } else {
            byAssignment.set(report.assignmentId, [report]);
        }
    }
    return [...byAssignment].map(([assignmentId, group]) => ({
        assignmentId,
        // The name any one of them carries. They agree unless a teacher renamed the set
        // between handing it out and collecting it back, in which case the first one
        // pasted names the group and the identity underneath is unaffected.
        assignmentName: group[0]?.assignmentName ?? "",
        columns: reportColumns(group),
        reports: group,
    }));
}

// The collected reports as a spreadsheet: one row per student, one column per
// piece of the assignment they answered, so it opens in whatever the teacher
// already uses to record marks.
export function reportsToCsv(
    reports: AssignmentReport[],
    pieceTitle: (id: string) => string,
): string {
    if (reports.length === 0) {
        return "";
    }
    const columns = reportColumns(reports);
    const header = ["Name", "Played", "Average", ...columns.map(pieceTitle)];
    const rows = reports.map((report) => {
        const { played, total, average } = reportSummary(report);
        const scores = new Map(report.items.map((item) => [item.id, item.score]));
        return [
            report.who,
            `${played}/${total}`,
            String(average),
            ...columns.map((id) => {
                const score = scores.get(id);
                return score === undefined || score === NOT_PLAYED ? "" : String(score);
            }),
        ];
    });
    return toCsv([header, ...rows]);
}
