// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { fakeMidi, fakeMidiInput } from "../../adapters/fakeMidi";
import { memoryStore } from "../../adapters/memoryStore";
import type { MidiAccessPort } from "../../ports/midiAccess";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import type { InstrumentRange } from "../../../core/instrumentRange";
import { createPrefsStore } from "../../stores/prefsStore";
import { InstrumentRangeSetting } from "./instrumentRangeSetting";

// What the panel says about four different rooms. Each story mounts its own MidiProvider
// over a scripted fake, shadowing the preview decorator's, so what is connected is a story
// input rather than whatever happens to be plugged into the machine drawing these.
const meta: Meta<typeof InstrumentRangeSetting> = {
    title: "Features/InstrumentRangeSetting",
    component: InstrumentRangeSetting,
};
export default meta;

type Story = StoryObj<typeof InstrumentRangeSetting>;

function Room({
    midi,
    measured = null,
    children,
}: {
    midi: MidiAccessPort;
    measured?: InstrumentRange | null;
    children?: ReactNode;
}) {
    const store = memoryStore();
    const prefs = createPrefsStore(store);
    prefs.save({ ...prefs.load(), instrumentRange: measured });
    return (
        <ServicesProvider services={{ midi, store }}>
            <MidiProvider>
                <div className="max-w-md">{children ?? <InstrumentRangeSetting />}</div>
            </MidiProvider>
        </ServicesProvider>
    );
}

const granted = (names: string[]) =>
    fakeMidi({
        permission: "granted",
        inputs: names.map((name, index) => fakeMidiInput({ id: `in-${index}`, name })),
    });

// Nothing plugged in: a full piano is assumed, and there is nothing to measure yet.
export const NoInstrument: Story = {
    render: () => <Room midi={granted([])} />,
};

// A keyboard whose name says what it is. The size is in force without anybody setting it,
// and the line says where it came from — the alternative is a number nobody chose
// appearing beside their music with no explanation.
export const ReadFromTheName: Story = {
    render: () => <Room midi={granted(["Keystation 61 MK3"])} />,
};

// A keyboard whose name gives nothing away, so the full piano stands until it is measured.
export const AnonymousInstrument: Story = {
    render: () => <Room midi={granted(["USB MIDI Device"])} />,
};

// Measured by playing the two ends: 49 keys, and the way back to a full piano beside it.
export const Measured: Story = {
    render: () => <Room midi={granted(["USB MIDI Device"])} measured={{ from: 36, to: 84 }} />,
};
