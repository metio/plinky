// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ChoiceField, SwitchField } from "../components/ui/fields";
import { ToggleIconButton } from "../components/ui/toggleIconButton";
import { choose, chosen, pressed, switchOn, toggle } from "./controls";

afterEach(cleanup);

function Fixture() {
    const [on, setOn] = useState(false);
    const [mode, setMode] = useState<"gentle" | "competitive">("gentle");
    const [held, setHeld] = useState(true);
    return (
        <>
            <SwitchField label="Play sounds" checked={on} onChange={setOn} />
            <ChoiceField
                label="Decay"
                value={mode}
                onChange={setMode}
                options={[
                    { id: "gentle", label: "Gentle" },
                    { id: "competitive", label: "Competitive" },
                ]}
            />
            <ToggleIconButton pressed={held} label="Metronome" onClick={() => setHeld((h) => !h)}>
                <svg role="presentation" />
            </ToggleIconButton>
        </>
    );
}

describe("controls test helpers", () => {
    it("toggles a switch and reads its state", () => {
        render(<Fixture />);
        expect(switchOn("Play sounds")).toBe(false);
        toggle("Play sounds");
        expect(switchOn("Play sounds")).toBe(true);
    });

    it("chooses a segment and reads back the selection", () => {
        render(<Fixture />);
        expect(chosen("Decay")).toBe("Gentle");
        choose("Decay", "Competitive");
        expect(chosen("Decay")).toBe("Competitive");
    });

    it("reads a toggle icon button's pressed state", () => {
        render(<Fixture />);
        expect(pressed("Metronome")).toBe(true);
    });

    it("accepts a message function as the label", () => {
        render(<Fixture />);
        expect(switchOn(() => "Play sounds")).toBe(false);
    });
});
