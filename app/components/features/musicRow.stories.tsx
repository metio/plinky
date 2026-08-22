// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { MusicItem } from "../../../core/music";
import { MusicRow } from "./musicRow";

// A row of the music list, which is mostly a piece's opening bars and its badges. The
// mark is the part worth watching: it is drawn from the manifest's baked string, and a
// change to the notation renderer shows up here before anywhere else.
const meta: Meta<typeof MusicRow> = {
    title: "Features/MusicRow",
    component: MusicRow,
    decorators: [
        (Story) => (
            <ul className="max-w-xl">
                <Story />
            </ul>
        ),
    ],
    args: {
        starred: false,
        learned: false,
        due: false,
        colored: false,
        onToggleStar: () => {},
    },
};
export default meta;

type Story = StoryObj<typeof MusicRow>;

const ODE: MusicItem = {
    id: "ode",
    title: "Ode to Joy",
    composer: "Ludwig van Beethoven",
    grade: 1,
    incipit: "G35q36q37q38q37q36q35q",
    removable: false,
    kind: "song",
};

export const Plain: Story = { args: { item: ODE } };

// With the reading aid on, the mark is coloured by note name — the same colours the
// score uses, so the row and the piece agree.
export const Coloured: Story = { args: { item: ODE, colored: true } };

// Starred, learned and due at once: every badge a row can carry, so their arrangement is
// pinned rather than discovered when three happen to land together.
export const EveryBadge: Story = {
    args: { item: ODE, starred: true, learned: true, due: true },
};

// A piece the player brought themselves carries the remove control; a catalogue piece
// never does.
export const Imported: Story = {
    args: {
        item: { ...ODE, id: "mine", title: "My Own Prelude", composer: "Me", removable: true },
        onRemove: () => {},
        removeConfirmLabel: "Remove",
    },
};

// No baked opening bars — the slot still holds its width, so a list of mixed rows keeps
// one column for the marks rather than ragging.
export const WithoutAMark: Story = {
    args: { item: { ...ODE, incipit: undefined } },
};
