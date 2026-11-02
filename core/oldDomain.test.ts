// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { MOVE_NOTICE_UNTIL, NEW_HOST, offerMove, OLD_HOST } from "./oldDomain";

const BEFORE = new Date("2026-11-02T12:00:00Z");
const AFTER = new Date("2027-06-01T12:00:00Z");

describe("offering the move off the old domain", () => {
    it("offers it on the old host, and nowhere else", () => {
        expect(offerMove(OLD_HOST, BEFORE)).toBe(true);
        expect(offerMove(NEW_HOST, BEFORE)).toBe(false);
        // A preview deploy and a dev server are not the old domain either, so neither
        // carries a notice about moving away from it.
        expect(offerMove("klimpi-preview.pages.dev", BEFORE)).toBe(false);
        expect(offerMove("localhost", BEFORE)).toBe(false);
    });

    it("stops offering it once the notice has run its course", () => {
        expect(offerMove(OLD_HOST, AFTER)).toBe(false);
    });

    it("stops on the day named, not a day either side of it", () => {
        expect(offerMove(OLD_HOST, new Date(`${MOVE_NOTICE_UNTIL}T00:00:00`))).toBe(false);
        const dayBefore = new Date(`${MOVE_NOTICE_UNTIL}T00:00:00`);
        dayBefore.setDate(dayBefore.getDate() - 1);
        expect(offerMove(OLD_HOST, dayBefore)).toBe(true);
    });

    // A host arrives from the browser, so it is worth saying plainly that nothing but an
    // exact match counts: a subdomain of the old host, or a domain merely ending in it,
    // is somebody else's.
    it("matches the host exactly", () => {
        for (const host of [
            `www.${OLD_HOST}`,
            `${OLD_HOST}.example.com`,
            `not-${OLD_HOST}`,
            OLD_HOST.toUpperCase(),
        ]) {
            expect(offerMove(host, BEFORE)).toBe(false);
        }
    });
});
