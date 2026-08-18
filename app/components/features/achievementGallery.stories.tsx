// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Achievement } from "../../../core/achievements";
import { AchievementGallery } from "./achievementGallery";

const meta: Meta<typeof AchievementGallery> = {
    title: "Features/AchievementGallery",
    component: AchievementGallery,
};
export default meta;

type Story = StoryObj<typeof AchievementGallery>;

const shelf = (earned: (id: string) => boolean): Achievement[] => [
    { id: "grade-1", kind: "grade", grade: 1, earned: earned("grade-1") },
    { id: "grade-3", kind: "grade", grade: 3, earned: earned("grade-3") },
    { id: "star-bronze", kind: "star", tier: "bronze", earned: earned("star-bronze") },
    { id: "star-gold", kind: "star", tier: "gold", earned: earned("star-gold") },
    { id: "firstS", kind: "firstS", earned: earned("firstS") },
    { id: "flawless", kind: "flawless", earned: earned("flawless") },
    { id: "days-10", kind: "days", target: 10, earned: earned("days-10") },
    { id: "notes-1000", kind: "notes", target: 1000, earned: earned("notes-1000") },
    { id: "ear-first", kind: "ear", badge: "first", earned: earned("ear-first") },
    { id: "ear-mastered", kind: "ear", badge: "mastered", earned: earned("ear-mastered") },
];

const EARNED = new Set(["grade-1", "star-bronze", "firstS", "days-10", "ear-first"]);

// Nothing earned yet. The unearned frame is deliberately not a padlock — same
// frame as an earned badge, quieter ground — so this is the state that proves it.
export const Fresh: Story = {
    render: () => <AchievementGallery achievements={shelf(() => false)} />,
};

// Part way along, which is the only state where lit and dim sit side by side and
// have to be told apart.
export const PartlyEarned: Story = {
    render: () => <AchievementGallery achievements={shelf((id) => EARNED.has(id))} />,
};

// The full shelf. Badges are cumulative and permanent, so this state never
// reverses.
export const Complete: Story = {
    render: () => <AchievementGallery achievements={shelf(() => true)} />,
};
