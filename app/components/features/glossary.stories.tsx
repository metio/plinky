// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { entryById, GLOSSARY, type GlossaryEntry } from "../../../core/glossary";
import { GlossaryDetail } from "./glossaryDetail";
import { GlossaryIndex } from "./glossaryIndex";

// The notation itself is drawn by an engine that loads on its own schedule, which a
// screenshot cannot wait for — so these stories stand a fixed placeholder in its slot
// and cover the surface around it: the grouping, the selected state, and whether a
// symbol offers one reading or two. The real drawing is covered in the browser suite.
const Placeholder = (
    <div className="flex h-24 items-center justify-center rounded-xl bg-paper text-xs text-paper-ink">
        notation
    </div>
);

const detail = (id: string): GlossaryEntry => entryById(id) ?? (GLOSSARY[0] as GlossaryEntry);

const meta: Meta<typeof GlossaryDetail> = {
    title: "Features/Glossary",
    component: GlossaryDetail,
};
export default meta;

type Story = StoryObj<typeof GlossaryDetail>;

// A mark you can hear both ways: two buttons, the second offering the same music plain.
export const HeardBothWays: Story = {
    render: () => (
        <GlossaryDetail
            entry={detail("staccato")}
            example={Placeholder}
            onHear={() => {}}
            onHearPlain={() => {}}
        />
    ),
};

// A mark that instructs the hands rather than the sound. There is nothing to compare
// it against, so it offers a single reading and says so by omission.
export const OneReadingOnly: Story = {
    render: () => (
        <GlossaryDetail
            entry={detail("slur")}
            example={Placeholder}
            onHear={() => {}}
            onHearPlain={null}
        />
    ),
};

// While the phrase is on the speakers, both readings rest — pressing again mid-phrase
// would lay one over the other and the comparison would stop being one.
export const Sounding: Story = {
    render: () => (
        <GlossaryDetail
            entry={detail("staccato")}
            example={Placeholder}
            sounding
            onHear={() => {}}
            onHearPlain={() => {}}
        />
    ),
};

// The way in: every symbol grouped by what it controls, with the open one marked.
export const Index: Story = {
    render: () => (
        <div className="max-w-56">
            <GlossaryIndex selected="staccato" onSelect={() => {}} />
        </div>
    ),
};
