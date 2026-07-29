// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { RunNote } from "../../../core/shareCard";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { SectionBest } from "./sectionBest";

// A clean run, so the bars are the same height in every screenshot rather than
// drifting with whatever the timing model does to a scruffier fixture.
const notes: RunNote[] = Array.from({ length: 24 }, (_, index) => ({
    targetMs: index * 500,
    playedMs: index * 500,
    wrongBefore: 0,
    staves: [0],
}));

const meta: Meta<typeof SectionBest> = {
    title: "Features/SectionBest",
    component: SectionBest,
};
export default meta;

function Panel({ best }: { best: number[] }) {
    return (
        <ServicesProvider
            services={{
                store: memoryStore({ "plinky:sectionbest:song": JSON.stringify(best) }),
            }}
        >
            <SectionBest scoreId="song" notes={notes} tolerance={60} tempoScale={1} />
        </ServicesProvider>
    );
}

// A piece part-learned: the opening solid, the end barely touched — the shape the
// record takes long before any single run is good throughout.
export const PartLearned: StoryObj<typeof SectionBest> = {
    render: () => <Panel best={[100, 92, 74, 51, 30, 12]} />,
};
