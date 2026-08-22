// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { chordPitches } from "../../../core/theory";
import { ChordReadout } from "./chordReadout";

const meta: Meta<typeof ChordReadout> = {
    title: "Features/ChordReadout",
    component: ChordReadout,
    decorators: [(Story) => <div className="max-w-md text-center">{Story()}</div>],
};
export default meta;

type Story = StoryObj<typeof ChordReadout>;

// Nothing held: the line stays, so naming a chord never pushes the page down under the
// reader's hands mid-play.
export const Silent: Story = { args: { notes: [] } };

export const OneNote: Story = { args: { notes: [60] } };

// Two notes are an interval, not a chord with something missing.
export const Interval: Story = { args: { notes: [60, 67] } };

export const Chord: Story = { args: { notes: chordPitches(60, "major") } };

export const SeventhChord: Story = { args: { notes: chordPitches(65, "dominant-seventh") } };

// An inversion is written the way a chart writes it — the bass after a slash — which is
// notation, so it reads the same in every language.
export const Inversion: Story = { args: { notes: [64, 67, 72] } };
