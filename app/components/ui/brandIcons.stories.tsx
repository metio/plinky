// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { type Brand, BrandIcon } from "./brandIcons";

const BRANDS: Brand[] = ["x", "bluesky", "threads", "whatsapp"];

const meta: Meta<typeof BrandIcon> = {
    title: "UI/BrandIcon",
    component: BrandIcon,
};
export default meta;

type Story = StoryObj<typeof BrandIcon>;

export const Gallery: Story = {
    render: () => (
        <div className="flex gap-6 text-gray-800 dark:text-gray-200">
            {BRANDS.map((brand) => (
                <div key={brand} className="flex flex-col items-center gap-1">
                    <BrandIcon brand={brand} className="h-6 w-6" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{brand}</span>
                </div>
            ))}
        </div>
    ),
};
