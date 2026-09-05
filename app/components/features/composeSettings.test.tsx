// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { m } from "../../paraglide/messages.js";
import { toggle } from "../../testing/controls";
import { ComposeSettings } from "./composeSettings";

const noop = () => {};

const mount = (overrides: Partial<Parameters<typeof ComposeSettings>[0]> = {}) =>
    render(
        <ComposeSettings
            title="Improvisation"
            onTitle={noop}
            tempo={120}
            onTempo={noop}
            beatsPerBar={4}
            onBeatsPerBar={noop}
            quantizeOn={true}
            onQuantize={noop}
            metronomeOn={false}
            onMetronome={noop}
            {...overrides}
        />,
    );

afterEach(cleanup);

describe("ComposeSettings", () => {
    it("edits the title", () => {
        const onTitle = vi.fn();
        mount({ onTitle });
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Nocturne" } });
        expect(onTitle).toHaveBeenCalledWith("Nocturne");
    });

    it("lets a tempo be typed digit by digit", () => {
        // Selecting "120" and typing "96": the "9" on its own is not a tempo and must not
        // be clamped to 40 before the "6" arrives.
        const onTempo = vi.fn();
        mount({ onTempo });
        const field = screen.getByLabelText("Tempo") as HTMLInputElement;
        fireEvent.change(field, { target: { value: "9" } });
        expect(onTempo).not.toHaveBeenCalled();
        expect(field.value).toBe("9");
        fireEvent.change(field, { target: { value: "96" } });
        expect(onTempo).toHaveBeenLastCalledWith(96);
    });

    it("settles what was typed into the 40–240 range on leaving the field", () => {
        const onTempo = vi.fn();
        mount({ onTempo });
        const field = screen.getByLabelText("Tempo") as HTMLInputElement;
        fireEvent.change(field, { target: { value: "999" } });
        expect(onTempo).not.toHaveBeenCalled();
        fireEvent.blur(field);
        expect(onTempo).toHaveBeenLastCalledWith(240);
        fireEvent.change(field, { target: { value: "3" } });
        fireEvent.blur(field);
        expect(onTempo).toHaveBeenLastCalledWith(40);
        fireEvent.change(field, { target: { value: "" } });
        fireEvent.blur(field);
        expect(onTempo).toHaveBeenLastCalledWith(120);
        // Settled, the field shows the take's tempo again rather than the stray text.
        expect(field.value).toBe("120");
    });

    it("selects a meter as a number", () => {
        const onBeatsPerBar = vi.fn();
        mount({ onBeatsPerBar });
        fireEvent.change(screen.getByLabelText("Time"), { target: { value: "3" } });
        expect(onBeatsPerBar).toHaveBeenCalledWith(3);
    });

    it("toggles quantize and metronome", () => {
        const onQuantize = vi.fn();
        const onMetronome = vi.fn();
        mount({ onQuantize, onMetronome });
        toggle(m.compose_quantize_label);
        expect(onQuantize).toHaveBeenCalledWith(false);
        toggle(m.compose_metronome_label);
        expect(onMetronome).toHaveBeenCalledWith(true);
    });
});
