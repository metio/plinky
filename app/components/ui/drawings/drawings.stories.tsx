// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarDrawing } from "./calendarDrawing";
import type { DrawingProps } from "./drawing";
import { HalfKeyboardDrawing } from "./halfKeyboardDrawing";
import { HeadphonesDrawing } from "./headphonesDrawing";
import { LoopDrawing } from "./loopDrawing";
import { MetronomeDrawing } from "./metronomeDrawing";
import { ShuffledPagesDrawing } from "./shuffledPagesDrawing";
import { TriadDrawing } from "./triadDrawing";

const DRAWINGS: [string, (props: DrawingProps) => React.JSX.Element][] = [
    ["Loop", LoopDrawing],
    ["Metronome", MetronomeDrawing],
    ["Half keyboard", HalfKeyboardDrawing],
    ["Headphones", HeadphonesDrawing],
    ["Shuffled pages", ShuffledPagesDrawing],
    ["Calendar", CalendarDrawing],
    ["Triad", TriadDrawing],
];

const meta: Meta = {
    title: "UI/Drawings",
};
export default meta;

type Story = StoryObj;

// The seven drawings at the size a method's leaf shows them, on the page's own ground, so a
// change of palette or mode shows in every one of them at once.
export const All: Story = {
    render: () => (
        <div className="grid max-w-2xl grid-cols-4 gap-6">
            {DRAWINGS.map(([name, Picture]) => (
                <figure key={name} className="space-y-1">
                    <Picture className="h-auto w-24" />
                    <figcaption className="text-xs text-muted">{name}</figcaption>
                </figure>
            ))}
        </div>
    ),
};
