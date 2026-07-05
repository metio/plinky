// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createHintsStore } from "./hintsStore";

describe("hintsStore", () => {
    it("has seen nothing at first, then remembers each hint", () => {
        const kv = memoryStore();
        const hints = createHintsStore(kv);
        expect(hints.seen("welcome")).toBe(false);
        expect(hints.markSeen("welcome")).toBe(true);
        expect(hints.seen("welcome")).toBe(true);
        // A second instance over the same store reads the same truth.
        expect(createHintsStore(kv).seen("welcome")).toBe(true);
    });

    it("marking an already-seen hint is a quiet no-op", () => {
        const hints = createHintsStore(memoryStore());
        const onChange = vi.fn();
        hints.markSeen("a");
        hints.subscribe(onChange);
        expect(hints.markSeen("a")).toBe(true);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("keeps hints independent", () => {
        const hints = createHintsStore(memoryStore());
        hints.markSeen("a");
        expect(hints.seen("b")).toBe(false);
    });

    it("reads corrupt storage as nothing seen", () => {
        expect(createHintsStore(memoryStore({ "plinky:seen-hints": "{oops" })).seen("a")).toBe(
            false,
        );
    });

    it("reports a refused write", () => {
        const hints = createHintsStore({ ...memoryStore(), set: () => false });
        expect(hints.markSeen("a")).toBe(false);
        expect(hints.seen("a")).toBe(false);
    });
});
