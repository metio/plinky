// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RecapCard } from "./recapCard";

const meta: Meta<typeof RecapCard> = {
    title: "Features/RecapCard",
    component: RecapCard,
    decorators: [
        (Story) => (
            <div className="w-96 p-4">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof RecapCard>;

export const AGoodMonth: Story = {
    args: {
        recap: {
            month: "2026-07",
            totalNotes: 4820,
            daysPracticed: 18,
            bestDay: { date: "2026-07-12", notes: 640 },
        },
    },
};

export const NoStandoutDay: Story = {
    args: {
        recap: { month: "2026-03", totalNotes: 120, daysPracticed: 2, bestDay: null },
    },
};
