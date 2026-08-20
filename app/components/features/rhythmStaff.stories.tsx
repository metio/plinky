// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { rhythmSvg } from "../../../core/rhythmNotation";
import { generateRhythm, RHYTHM_LEVELS } from "../../../core/rhythmPattern";

// The drawing on its own, with no clock running. The trainer around it is a timing
// surface and cannot be screenshotted honestly; the notation is pure markup from a pure
// function, so a fixed seed draws the same bar every time.
const seeded = (start: number) => {
    let state = start;
    return () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
    };
};

function Staff({ level, seed, marked }: { level: number; seed: number; marked?: boolean }) {
    const pattern = generateRhythm(level, seeded(seed));
    const notes = pattern.cells.filter((cell) => !cell.rest).length;
    const marks = marked
        ? pattern.cells
              .filter((cell) => !cell.rest)
              .map((_, index) =>
                  index === 1
                      ? ("off" as const)
                      : index === 3
                        ? ("missed" as const)
                        : index % 2 === 0
                          ? ("perfect" as const)
                          : ("good" as const),
              )
        : undefined;
    return (
        <div className="max-w-3xl overflow-x-auto p-4 text-ink">
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: core-generated SVG */}
            <div dangerouslySetInnerHTML={{ __html: rhythmSvg({ pattern, marks }) }} />
            <p className="text-xs text-muted">
                level {level + 1} · {notes} notes
            </p>
        </div>
    );
}

const meta: Meta<typeof Staff> = { title: "Features/RhythmStaff", component: Staff };
export default meta;
type Story = StoryObj<typeof Staff>;

// The first rung: bare beats, nothing to divide.
export const Quarters: Story = { render: () => <Staff level={0} seed={11} /> };

// Beamed eighths and rests — where reading a rhythm stops being reading the pulse.
export const Eighths: Story = { render: () => <Staff level={5} seed={4} /> };

// Sixteenths: the spacing has to hold four notes in a beat without them touching.
export const Sixteenths: Story = { render: () => <Staff level={9} seed={6} /> };

// Compound time, counted in dotted beats rather than in eighths.
export const Compound: Story = {
    render: () => <Staff level={RHYTHM_LEVELS.length - 1} seed={8} />,
};

// A finished attempt, drawn back under the notes it belongs to.
export const Marked: Story = { render: () => <Staff level={5} seed={4} marked /> };
