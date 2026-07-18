// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { EAR_ITEMS } from "../../core/earCatalog";
import { m } from "../paraglide/messages.js";
import { earItemTitle } from "./earLabels";

describe("earItemTitle", () => {
    it("titles a laddered item by its exercise and level", () => {
        const chords1 = EAR_ITEMS.find((item) => item.id === "ear-chords-1")!;
        expect(earItemTitle(chords1)).toBe(
            `${m.ear_exercise_chords()} · ${m.ear_chord_level_triads()}`,
        );
    });

    it("titles perfect pitch by its name alone, having no levels", () => {
        const pitch = EAR_ITEMS.find((item) => item.id === "ear-perfect-pitch")!;
        expect(earItemTitle(pitch)).toBe(m.ear_exercise_perfect_pitch());
    });

    it("gives every ear item a title from its own exercise, never a fallback", () => {
        // Guards the bug where every non-interval item fell through to "Perfect pitch":
        // only the perfect-pitch item may carry that name.
        for (const item of EAR_ITEMS) {
            const title = earItemTitle(item);
            expect(title.length).toBeGreaterThan(0);
            if (item.exercise !== "perfect-pitch") {
                expect(title).not.toBe(m.ear_exercise_perfect_pitch());
            }
        }
    });
});
