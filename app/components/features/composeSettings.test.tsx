// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMidiFile } from "../../../core/midiFile";
import { parseMidiFile } from "../../../core/midiParse";
import { parseMusicXml } from "../../../core/musicxmlParse";
import { domXmlCodec } from "../../adapters/domXmlCodec";
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

    it("keeps the meter the take was loaded in on offer once another is chosen", () => {
        mount({ beatsPerBar: 2, loadedBeatsPerBar: 5 });
        const time = screen.getByLabelText(m.compose_beats_label()) as HTMLSelectElement;
        expect([...time.options].map((option) => option.value)).toEqual(["2", "3", "4", "5", "6"]);
        expect(time.value).toBe("2");
    });

    it("selects a meter as a number", () => {
        const onBeatsPerBar = vi.fn();
        mount({ onBeatsPerBar });
        fireEvent.change(screen.getByLabelText("Time"), { target: { value: "3" } });
        expect(onBeatsPerBar).toHaveBeenCalledWith(3);
    });

    it("shows the meter of a 5/4 MIDI file it was loaded from", () => {
        const loaded = parseMidiFile(
            buildMidiFile([{ midi: 60, startQuarters: 0, durationQuarters: 1 }], {
                beatsPerBar: 5,
            }),
        );
        expect(loaded?.beatsPerBar).toBe(5);
        mount({ beatsPerBar: loaded!.beatsPerBar });
        const field = screen.getByLabelText("Time") as HTMLSelectElement;
        expect(field.value).toBe("5");
        expect(field.selectedOptions[0]?.textContent).toBe("5/4");
    });

    it("shows the meter of a 12/8 MusicXML file it was loaded from", () => {
        const xml = `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>12</beats><beat-type>8</beat-type></time></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
        const loaded = parseMusicXml(domXmlCodec, xml);
        expect(loaded?.beatsPerBar).toBe(12);
        mount({ beatsPerBar: loaded!.beatsPerBar });
        expect((screen.getByLabelText("Time") as HTMLSelectElement).value).toBe("12");
    });

    it("moves a loaded 5/4 take to 2/4 when 2/4 is picked", () => {
        // With no option for 5 the field would already show the first one, 2/4, and
        // picking it would change nothing.
        const onBeatsPerBar = vi.fn();
        mount({ beatsPerBar: 5, onBeatsPerBar });
        const field = screen.getByLabelText("Time") as HTMLSelectElement;
        expect(field.value).not.toBe("2");
        fireEvent.change(field, { target: { value: "2" } });
        expect(onBeatsPerBar).toHaveBeenCalledWith(2);
    });

    it("offers the four usual meters and nothing else for a usual one", () => {
        mount({ beatsPerBar: 3 });
        const field = screen.getByLabelText("Time") as HTMLSelectElement;
        expect([...field.options].map((option) => option.value)).toEqual(["2", "3", "4", "6"]);
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
