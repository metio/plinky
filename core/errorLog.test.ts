// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { foldError, type LoggedError, MAX_LOGGED, MAX_MESSAGE, parseErrorLog } from "./errorLog";

const fault = (message: string, where = "/en/play/x/", at = 1000): LoggedError => ({
    at,
    message,
    where,
    count: 1,
});

describe("foldError", () => {
    it("puts the newest fault first", () => {
        const log = foldError(foldError([], { message: "one", where: "/a", at: 1 }), {
            message: "two",
            where: "/a",
            at: 2,
        });

        expect(log.map((one) => one.message)).toEqual(["two", "one"]);
    });

    it("counts a repeat instead of appending it", () => {
        // A loop that throws every frame is one problem. Ten copies would push out the
        // nine faults before it and say less than a count does.
        let log: LoggedError[] = [];
        for (let i = 0; i < 500; i++) {
            log = foldError(log, { message: "same", where: "/a", at: i });
        }

        expect(log).toHaveLength(1);
        expect(log[0]?.count).toBe(500);
        expect(log[0]?.at).toBe(499);
    });

    it("counts a repeat found anywhere, not only the newest", () => {
        // Two faults alternating would otherwise fill the log with one bug twice over
        // and evict everything that came before.
        let log: LoggedError[] = [];
        for (let i = 0; i < 20; i++) {
            log = foldError(log, { message: i % 2 === 0 ? "a" : "b", where: "/p", at: i });
        }

        expect(log).toHaveLength(2);
        expect(log.map((one) => one.count).sort()).toEqual([10, 10]);
    });

    it("treats the same message on a different page as a different fault", () => {
        const log = foldError(foldError([], { message: "boom", where: "/a", at: 1 }), {
            message: "boom",
            where: "/b",
            at: 2,
        });

        expect(log).toHaveLength(2);
    });

    it("keeps only the most recent faults", () => {
        let log: LoggedError[] = [];
        for (let i = 0; i < MAX_LOGGED + 5; i++) {
            log = foldError(log, { message: `fault ${i}`, where: "/a", at: i });
        }

        expect(log).toHaveLength(MAX_LOGGED);
        expect(log[0]?.message).toBe(`fault ${MAX_LOGGED + 4}`);
    });

    it("collapses whitespace and truncates a long stack", () => {
        // A minified stack runs to kilobytes, and the first line is what distinguishes
        // one fault from another.
        const log = foldError([], { message: `x${"y".repeat(5000)}`, where: "/a", at: 1 });

        expect(log[0]?.message).toHaveLength(MAX_MESSAGE + 1); // the ellipsis
        expect(log[0]?.message.endsWith("…")).toBe(true);
    });

    it("folds a multi-line stack onto one line so a repeat is recognised", () => {
        const log = foldError([], { message: "boom\n   at foo\n   at bar", where: "/a", at: 1 });

        expect(log[0]?.message).toBe("boom at foo at bar");
    });
});

describe("parseErrorLog", () => {
    it("reads back what was written", () => {
        const log = [fault("boom")];
        expect(parseErrorLog(JSON.parse(JSON.stringify(log)))).toEqual(log);
    });

    it("drops malformed entries rather than failing the page", () => {
        const parsed = parseErrorLog([
            fault("good"),
            null,
            "nonsense",
            { at: "soon", message: "m", where: "/a", count: 1 },
            { at: 1, message: 5, where: "/a", count: 1 },
            { at: 1, message: "m", where: "/a", count: 0 },
            { at: Number.NaN, message: "m", where: "/a", count: 1 },
        ]);

        expect(parsed.map((one) => one.message)).toEqual(["good"]);
    });

    it("reads anything that is not a list as an empty log", () => {
        expect(parseErrorLog(null)).toEqual([]);
        expect(parseErrorLog({ at: 1 })).toEqual([]);
        expect(parseErrorLog(undefined)).toEqual([]);
    });

    it("caps a log that arrived longer than the limit", () => {
        const many = Array.from({ length: 50 }, (_, i) => fault(`fault ${i}`));
        expect(parseErrorLog(many)).toHaveLength(MAX_LOGGED);
    });
});
