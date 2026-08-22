// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { MusicFilters } from "./musicFilters";

const meta: Meta<typeof MusicFilters> = {
    title: "Features/MusicFilters",
    component: MusicFilters,
    decorators: [
        (Story) => (
            <div className="max-w-2xl space-y-2">
                <Story />
            </div>
        ),
    ],
    args: {
        kind: "",
        onKind: () => {},
        grades: new Set<number>(),
        onToggleGrade: () => {},
        onClearGrades: () => {},
        favoritesOnly: false,
        onToggleFavoritesOnly: () => {},
        dueOnly: false,
        freshOnly: false,
        onToggleFreshOnly: () => {},
        onToggleDueOnly: () => {},
        showDue: false,
    },
};
export default meta;

type Story = StoryObj<typeof MusicFilters>;

// Nothing filtered, which is what a first visit sees. The Due chip is absent
// because nothing is due yet.
export const Unfiltered: Story = {};

// A kind picked and two grades on. Kind is single-select and Grade is
// multi-select, so the two groups have to look like different questions.
export const Filtered: Story = { args: { kind: "study", grades: new Set([2, 3]) } };

// Once something is due, the third group grows a chip.
export const WithDue: Story = { args: { showDue: true, dueOnly: true } };

// Every toggle in the Show group on at once.
export const AllToggles: Story = {
    args: { showDue: true, dueOnly: true, freshOnly: true, favoritesOnly: true },
};
