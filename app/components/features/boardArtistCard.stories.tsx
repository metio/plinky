// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { BoardArtistCard } from "./boardArtistCard";

// A deterministic stand-in portrait: an inline SVG gradient, so the story
// rasterizes identically everywhere with no network fetch.
const portrait = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#a855f7"/>' +
        '</linearGradient></defs><rect width="400" height="500" fill="url(#g)"/>' +
        '<circle cx="200" cy="180" r="70" fill="#ffffff55"/>' +
        '<rect x="110" y="280" width="180" height="160" rx="80" fill="#ffffff55"/></svg>',
)}`;

const meta: Meta<typeof BoardArtistCard> = {
    title: "Features/BoardArtistCard",
    component: BoardArtistCard,
    decorators: [
        (Story) => (
            <div className="max-w-sm p-8">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof BoardArtistCard>;

export const Instagram: Story = {
    args: {
        tilt: "left",
        artist: {
            id: "a-ada",
            name: "Ada Keys",
            order: 0,
            text: "Plays a nocturne a day and shows every wrong note on the way.\n\nStart with her slow-practice series.",
            imageUrl: portrait,
            imageAlt: "Ada at the piano",
            linkUrl: "https://www.instagram.com/adakeys",
        },
    },
};

export const NoImageUnknownLink: Story = {
    args: {
        tilt: "right",
        artist: {
            id: "a-ben",
            name: "Ben Pedal",
            order: 1,
            text: "Writes one tiny étude a week, free to play.",
            linkUrl: "https://benpedal.example.com",
        },
    },
};
