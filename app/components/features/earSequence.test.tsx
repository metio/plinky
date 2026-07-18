// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChordDegree } from "../../../core/theory";
import { m } from "../../paraglide/messages.js";
import { EarSequence } from "./earSequence";

afterEach(cleanup);

const SEQUENCE: ChordDegree[] = ["I", "IV", "V", "I"];
const VOCAB: ChordDegree[] = ["I", "IV", "V"];

const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("EarSequence", () => {
    it("offers a keypad of the level's chords", () => {
        render(
            <EarSequence
                sequence={SEQUENCE}
                choices={VOCAB}
                settled={false}
                onComplete={() => {}}
                label="progression"
            />,
        );
        for (const degree of VOCAB) {
            expect(screen.getByRole("button", { name: degree })).toBeTruthy();
        }
    });

    it("emits the joined sequence only once every chord is entered", () => {
        const onComplete = vi.fn();
        render(
            <EarSequence
                sequence={SEQUENCE}
                choices={VOCAB}
                settled={false}
                onComplete={onComplete}
                label="progression"
            />,
        );
        press("I");
        press("IV");
        press("V");
        expect(onComplete).not.toHaveBeenCalled(); // three of four — not done
        press("I");
        expect(onComplete).toHaveBeenCalledWith("I-IV-V-I");
    });

    it("undoes the last chord before the sequence is complete", () => {
        const onComplete = vi.fn();
        render(
            <EarSequence
                sequence={SEQUENCE}
                choices={VOCAB}
                settled={false}
                onComplete={onComplete}
                label="progression"
            />,
        );
        press("I");
        press("IV");
        press(m.ear_progression_undo()); // take back the IV
        press("V"); // so the second chord is now V, not IV
        press("V");
        press("I");
        expect(onComplete).toHaveBeenCalledWith("I-V-V-I");
    });

    it("marks each slot right or wrong and reveals the answer once settled", () => {
        // The component fills its own entry while live, then the parent flips it to
        // settled with that entry preserved — the same instance, so a rerender models it.
        const props = {
            sequence: SEQUENCE,
            choices: VOCAB,
            onComplete: () => {},
            label: "progression",
        };
        const { rerender } = render(<EarSequence {...props} settled={false} />);
        press("I");
        press("V"); // wrong: should have been IV
        press("V");
        press("I");
        rerender(<EarSequence {...props} settled={true} />);

        // "IV" now appears twice: the keypad button, and the reveal in the wrong slot
        // (which was answered V) — before settling it was only the keypad.
        expect(screen.getAllByText("IV")).toHaveLength(2);
        // The wrong pick and both correct I's stay on screen.
        expect(screen.getAllByText("V").length).toBeGreaterThanOrEqual(1);
    });
});
