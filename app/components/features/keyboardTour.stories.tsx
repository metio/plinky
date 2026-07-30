// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { fakeMidi } from "../../adapters/fakeMidi";
import { memoryStore } from "../../adapters/memoryStore";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { KeyboardTour } from "./keyboardTour";

// The tour as a beginner first meets it: the black-key groups, before any notation.
// The opening step draws no staff, so the story has nothing async in it and settles in
// one frame.
const meta: Meta<typeof KeyboardTour> = {
    title: "Features/KeyboardTour",
    component: KeyboardTour,
    decorators: [
        (Story) => (
            <ServicesProvider
                services={{ store: memoryStore(), audio: fakeAudioEngine(), midi: fakeMidi() }}
            >
                <MidiProvider>
                    <Story />
                </MidiProvider>
            </ServicesProvider>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof KeyboardTour>;

export const FirstStep: Story = {
    args: { onFinished: () => {} },
};
