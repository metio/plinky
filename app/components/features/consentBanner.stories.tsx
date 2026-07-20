// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { ConsentBanner } from "./consentBanner";

// A fresh in-memory store keeps the choice unanswered, so the banner always shows
// for the shot rather than depending on whatever the browser has stored.
const store = memoryStore();

const meta: Meta<typeof ConsentBanner> = {
    title: "Features/ConsentBanner",
    component: ConsentBanner,
    decorators: [
        (Story) => (
            <ServicesProvider services={{ store }}>
                <Story />
            </ServicesProvider>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof ConsentBanner>;

export const Default: Story = {};
