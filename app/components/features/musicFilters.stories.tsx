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

// A phone. Every other story is 2xl wide, where nothing overflows and each group renders
// as one comfortable row — which is to say none of them can see the state this component
// was built for. At 390px the chips run past the edge of their track and the last one is
// cut mid-word, and that clipped chip IS the affordance: it is what says there is more to
// the right. Without this baseline a change that broke the strips would pass every
// screenshot the component has.
export const Narrow: Story = {
    args: { showDue: true },
    decorators: [
        (Story) => (
            <div className="w-[390px] space-y-2">
                <Story />
            </div>
        ),
    ],
};
