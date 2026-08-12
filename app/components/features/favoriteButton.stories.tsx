// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { createFavoritesStore } from "../../stores/favoritesStore";
import { FavoriteButton } from "./favoriteButton";

// The star as it sits beside a piece's title. Both states are the same component over
// differently seeded data — an in-memory favourites store, no browser storage — so the
// pair shows what the shape carries: outlined until you keep a piece, filled once you
// have, which is the same star the library row draws.
const meta: Meta<typeof FavoriteButton> = {
    title: "Features/FavoriteButton",
    component: FavoriteButton,
};
export default meta;

type Story = StoryObj<typeof FavoriteButton>;

export const NotStarred: Story = {
    render: function Render() {
        const favorites = createFavoritesStore(memoryStore());
        return (
            <ServicesProvider services={{ favorites }}>
                <FavoriteButton id="story-piece" />
            </ServicesProvider>
        );
    },
};

export const Starred: Story = {
    render: function Render() {
        const favorites = createFavoritesStore(memoryStore());
        favorites.toggle("story-piece");
        return (
            <ServicesProvider services={{ favorites }}>
                <FavoriteButton id="story-piece" />
            </ServicesProvider>
        );
    },
};
