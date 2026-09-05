// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { WeekChart } from "./weekChart";

const meta: Meta<typeof WeekChart> = { title: "Features/WeekChart", component: WeekChart };
export default meta;

type Story = StoryObj<typeof WeekChart>;

const week = (notes: number[]) =>
    notes.map((count, index) => ({ date: `2026-03-0${index + 2}`, notes: count }));

// An ordinary week, with the quiet days a week actually has. Nothing here counts
// consecutive days — a gap is just a gap.
export const Ordinary: Story = {
    render: () => <WeekChart days={week([40, 0, 120, 90, 0, 60, 150])} />,
};

// One busy day among quiet ones. The bars scale to the busiest day, so this is
// where the scaling either reads or flattens everything else to nothing.
export const OneBigDay: Story = {
    render: () => <WeekChart days={week([8, 4, 0, 900, 6, 0, 12])} />,
};

// A week with nothing in it: the floor of 1 keeps the axis from dividing by zero,
// and the chart still shows its shape rather than collapsing.
export const Empty: Story = { render: () => <WeekChart days={week([0, 0, 0, 0, 0, 0, 0])} /> };

// A Wednesday: the week so far is three bars, not seven. The chart draws the calendar
// week up to today rather than padding the days that have not happened yet.
export const Midweek: Story = { render: () => <WeekChart days={week([40, 120, 90])} /> };
