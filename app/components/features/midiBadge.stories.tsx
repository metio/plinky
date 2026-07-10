// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { fakeMidi, fakeMidiInput } from "../../adapters/fakeMidi";
import { MidiProvider } from "../../contexts/midi";
import type { MidiAccessPort } from "../../ports/midiAccess";
import { ServicesProvider } from "../../contexts/services";
import { MidiBadge } from "./midiBadge";

// Each story mounts its own MidiProvider over a scripted fake, shadowing the
// preview decorator's provider, so the connection state is a story input rather
// than whatever the host browser exposes. The badge positions itself absolutely
// in a keyboard's corner, so a relative frame stands in for the keyboard.
function Frame({ midi, children }: { midi: MidiAccessPort; children: ReactNode }) {
    return (
        <ServicesProvider services={{ midi }}>
            <MidiProvider>
                <div className="relative h-16 w-40 rounded-md border border-gray-300 dark:border-gray-700">
                    {children}
                </div>
            </MidiProvider>
        </ServicesProvider>
    );
}

const meta: Meta<typeof MidiBadge> = {
    title: "Features/MidiBadge",
    component: MidiBadge,
};
export default meta;

type Story = StoryObj<typeof MidiBadge>;

export const Disconnected: Story = {
    render: function Render() {
        return (
            <Frame midi={fakeMidi({ supported: true })}>
                <MidiBadge />
            </Frame>
        );
    },
};

export const Connected: Story = {
    render: function Render() {
        // A granted permission makes the provider silently reconnect on mount,
        // so the fake's input reads as a plugged-in piano.
        const midi = fakeMidi({ permission: "granted", inputs: [fakeMidiInput()] });
        return (
            <Frame midi={midi}>
                <MidiBadge />
            </Frame>
        );
    },
};
