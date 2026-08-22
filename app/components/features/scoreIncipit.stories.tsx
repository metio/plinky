// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { buildScore } from "../../../core/musicxmlBuild";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { createPrefsStore } from "../../stores/prefsStore";
import { ScoreIncipit } from "./scoreIncipit";

// A prefs store with the colour aid on, so the story shows what the setting does rather
// than what the default happens to be.
const prefsWithColour = (colorNotes: boolean) => {
    const prefs = createPrefsStore(memoryStore());
    prefs.save({ ...prefs.load(), colorNotes });
    return prefs;
};

const meta: Meta<typeof ScoreIncipit> = {
    title: "Features/ScoreIncipit",
    component: ScoreIncipit,
    decorators: [
        (Story) => (
            <ServicesProvider services={{}}>
                <Story />
            </ServicesProvider>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof ScoreIncipit>;

const note = (step: string, octave: number, value: "eighth" | "quarter" | "half" = "quarter") => ({
    pitch: { step, octave, alter: 0 },
    value,
});

// A rising phrase in C: eight noteheads, hollow from a minim up, with the stems
// and ledger lines the mark draws and none of the flags or beams it leaves out.
const RISING = buildScore({
    title: "Rising",
    fifths: 0,
    beatsPerBar: 4,
    treble: [
        note("C", 4),
        note("E", 4),
        note("G", 4),
        note("C", 5),
        note("B", 4),
        note("G", 4),
        note("E", 4),
        note("C", 4, "half"),
    ],
});

// A grand staff, so the mark has to pick the hand it reads rather than stacking
// both onto one line.
const GRAND = buildScore({
    title: "Both hands",
    fifths: -1,
    beatsPerBar: 3,
    treble: [note("F", 4), note("A", 4), note("C", 5), note("A", 4, "half"), note("F", 4)],
    bass: [note("F", 2), note("C", 3), note("F", 2), note("C", 3, "half"), note("F", 2)],
});

// The opening bar beside a name, the way a thematic catalogue identifies a work.
//
// Colour is set explicitly here rather than left to the default, which is ON: a story that
// only turned it on would draw the same picture as this one, and a pair of identical
// baselines pins nothing. The two differ, so a mark that stopped reading the setting moves
// one of them.
export const Mark: Story = {
    args: { xml: RISING, title: "Rising" },
    decorators: [
        (Story) => (
            <ServicesProvider services={{ prefs: prefsWithColour(false) }}>
                <Story />
            </ServicesProvider>
        ),
    ],
};

// With the colour setting on it reads by note name, the same as the baked marks on every
// list — a piece looks the same on the shelf and on its own page.
export const Coloured: Story = {
    args: { xml: RISING, title: "Rising" },
    decorators: [
        (Story) => (
            <ServicesProvider services={{ prefs: prefsWithColour(true) }}>
                <Story />
            </ServicesProvider>
        ),
    ],
};

// A key signature in force travels with the notehead: the mark draws no key
// signature, so a flat has to be written on the note or the pitch shown is wrong.
export const GrandStaff: Story = { args: { xml: GRAND, title: "Both hands" } };

// A piece whose notation has not been fetched simply shows no mark — reading one
// costs a parse of a score already in hand, and never a request.
export const NoNotation: Story = {
    args: { xml: "", title: "Not fetched" },
    render: (args) => (
        <p className="text-sm text-muted">
            <ScoreIncipit {...args} />
            No mark, because there is no score in hand yet.
        </p>
    ),
};
