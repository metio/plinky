// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { runSettled } from "./runEnd";

describe("runSettled", () => {
    it("settles a finished run once every key is up", () => {
        expect(runSettled({ complete: true, holdingNote: false })).toBe(true);
    });

    it("waits while the final note is still held", () => {
        expect(runSettled({ complete: true, holdingNote: true })).toBe(false);
    });

    it("never settles a run that has not finished, held or not", () => {
        expect(runSettled({ complete: false, holdingNote: false })).toBe(false);
        expect(runSettled({ complete: false, holdingNote: true })).toBe(false);
    });
});
