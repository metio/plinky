// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { PersonCount } from "../../../core/person";
import { ComposerList } from "./composerList";

const meta: Meta<typeof ComposerList> = {
    title: "Features/ComposerList",
    component: ComposerList,
    decorators: [
        (Story) => (
            <div className="max-w-md">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof ComposerList>;

// Alphabetical, which is how a directory is read, and with counts that run from
// one piece to hundreds — the column has to stay aligned across both.
const PEOPLE: PersonCount[] = [
    { slug: "amy-beach", name: "Amy Beach", pieces: 1 },
    { slug: "claude-debussy", name: "Claude Debussy", pieces: 24 },
    { slug: "ferdinand-beyer", name: "Ferdinand Beyer", pieces: 106 },
    { slug: "gabriel-faure", name: "Gabriel Fauré", pieces: 7 },
    { slug: "johann-sebastian-bach", name: "Johann Sebastian Bach", pieces: 312 },
    { slug: "scott-joplin", name: "Scott Joplin", pieces: 18 },
];

// Everybody the catalogue credits, including the composer it credits only once.
export const Directory: Story = { args: { people: PEOPLE, query: "" } };

// The search folds accents, so "faure" finds Fauré without the reader having to
// type the é.
export const Searched: Story = { args: { people: PEOPLE, query: "faure" } };

// A search that matches nobody says so rather than showing an empty list.
export const NoMatch: Story = { args: { people: PEOPLE, query: "nobody at all" } };
