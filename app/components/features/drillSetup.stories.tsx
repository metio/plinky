// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { DEFAULT_DRILL, type DrillOptions } from "../../../core/drill";
import { DrillSetup } from "./drillSetup";

// The panel owns no state, so the story holds the drill and hands it back — the
// same shape the warm-up tab uses.
const meta: Meta<typeof DrillSetup> = {
    title: "Features/DrillSetup",
    component: DrillSetup,
};
export default meta;

type Story = StoryObj<typeof DrillSetup>;

function Panel({ start }: { start: DrillOptions }) {
    const [drill, setDrill] = useState(start);
    return <DrillSetup value={drill} onChange={setDrill} />;
}

export const Default: Story = {
    render: () => <Panel start={DEFAULT_DRILL} />,
};

// A drill shaped well past the beginner default: a flat key read chromatically,
// two hands over four octaves, three-note chords held close together.
export const Shaped: Story = {
    render: () => (
        <Panel
            start={{
                ...DEFAULT_DRILL,
                bars: 16,
                fifths: -3,
                chromatic: true,
                hands: 2,
                low: 36,
                high: 84,
                notesPerColumn: 3,
                rhythm: "varied",
                maxLeap: 7,
                smoothness: 4,
            }}
        />
    ),
};
