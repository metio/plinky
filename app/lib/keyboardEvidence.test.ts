// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { createKeyboardEvidence } from "./keyboardEvidence";

describe("keyboard evidence", () => {
    it("has seen no keyboard until one is noted", () => {
        expect(createKeyboardEvidence().seen()).toBe(false);
    });

    it("remembers a keyboard once noted", () => {
        const evidence = createKeyboardEvidence();
        evidence.note();
        expect(evidence.seen()).toBe(true);
    });

    it("tells its subscribers once, however many keys follow", () => {
        const evidence = createKeyboardEvidence();
        const heard = vi.fn();
        evidence.subscribe(heard);
        evidence.note();
        evidence.note();
        expect(heard).toHaveBeenCalledTimes(1);
    });

    it("stops telling a subscriber that has let go", () => {
        const evidence = createKeyboardEvidence();
        const heard = vi.fn();
        evidence.subscribe(heard)();
        evidence.note();
        expect(heard).not.toHaveBeenCalled();
    });

    it("keeps each instance to itself", () => {
        const one = createKeyboardEvidence();
        const other = createKeyboardEvidence();
        one.note();
        expect(other.seen()).toBe(false);
    });
});
