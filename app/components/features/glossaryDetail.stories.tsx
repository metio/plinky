// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { entryById } from "../../../core/glossary";
import { GlossaryDetail } from "./glossaryDetail";

const meta: Meta<typeof GlossaryDetail> = {
    title: "Features/GlossaryDetail",
    component: GlossaryDetail,
    decorators: [
        (Story) => (
            <div className="max-w-lg">
                <Story />
            </div>
        ),
    ],
    args: { onHear: () => {}, onHearPlain: () => {} },
};
export default meta;

type Story = StoryObj<typeof GlossaryDetail>;

// The notation arrives as a slot, so a story hands in a still picture and the
// drawing engine stays out of it entirely.
const Example = () => (
    <div className="flex h-24 items-center justify-center rounded-md border border-line bg-sunken text-sm text-muted">
        the bar of music, drawn here
    </div>
);

const STACCATO = entryById("staccato");
const SLUR = entryById("slur");

// A mark you can hear the difference in: two readings offered, with and without.
export const WithComparison: Story = {
    args: { entry: STACCATO!, example: <Example /> },
};

// A slur instructs the hands rather than the ear, so there is no "without" to
// offer — promising a difference that isn't there would teach the wrong thing.
export const SingleReading: Story = {
    args: { entry: SLUR!, example: <Example />, onHearPlain: null },
};

// While the phrase is on the speakers both buttons rest, so two readings cannot
// overlap into something neither of them sounds like.
export const Sounding: Story = {
    args: { entry: STACCATO!, example: <Example />, sounding: true },
};
