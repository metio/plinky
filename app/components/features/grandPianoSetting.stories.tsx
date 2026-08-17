// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { SampleManifest } from "../../../core/sampledPiano";
import { fakeSampleSource } from "../../adapters/fakeSampleSource";
import { ServicesProvider } from "../../contexts/services";
import { GrandPianoSetting } from "./grandPianoSetting";

// The three states the switch actually has, drawn from an injected source rather than a
// real one: the real adapter would reach for an origin and a cache, and a story that
// depends on a network is a story that renders differently on a bad day.
const meta: Meta<typeof GrandPianoSetting> = {
    title: "Features/GrandPianoSetting",
    component: GrandPianoSetting,
};
export default meta;

type Story = StoryObj<typeof GrandPianoSetting>;

const MANIFEST: SampleManifest = {
    instrument: "Salamander Grand Piano V3",
    author: "Alexander Holm",
    license: "CC-BY-3.0",
    source: "https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html",
    version: "v1",
    notes: [],
    releases: [],
};

// A device that has never asked for the recordings: the switch and its one line of
// explanation, and nothing else to look at.
export const Synthesised: Story = {
    render: function Render() {
        const samples = fakeSampleSource(null);
        void samples.forget();
        return (
            <ServicesProvider services={{ samples }}>
                <GrandPianoSetting />
            </ServicesProvider>
        );
    },
};

// On, with the instrument known. The credit under the switch is the licence's own
// condition, so it is part of the design rather than a detail — this story is what would
// catch it going missing.
export const Recorded: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={{ samples: fakeSampleSource(MANIFEST) }}>
                <GrandPianoSetting />
            </ServicesProvider>
        );
    },
};

// On, with recordings on the device. The figure is what this device is holding, which is
// the only storage question a player can act on.
export const Holding: Story = {
    render: function Render() {
        const samples = fakeSampleSource(MANIFEST);
        // A piece's worth of recordings, so the figure reads the way it will in life.
        samples.put("C4v8.opus", { duration: 4 } as AudioBuffer);
        samples.put("C4v12.opus", { duration: 4 } as AudioBuffer);
        return (
            <ServicesProvider services={{ samples }}>
                <GrandPianoSetting />
            </ServicesProvider>
        );
    },
};

// Switched on before the instrument has been reached: it says so rather than showing an
// empty space where the credit will be.
export const Arriving: Story = {
    render: function Render() {
        const samples = fakeSampleSource(null);
        void samples.enable();
        return (
            <ServicesProvider services={{ samples }}>
                <GrandPianoSetting />
            </ServicesProvider>
        );
    },
};
