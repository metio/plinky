// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
    stories: ["../app/**/*.stories.@(ts|tsx)"],
    addons: ["@storybook/addon-vitest"],
    framework: { name: "@storybook/react-vite", options: {} },
    core: { disableTelemetry: true },
    // Storybook merges the app's vite.config.ts, which carries the React Router
    // plugin — that plugin is for the app build and breaks Storybook (and its
    // test runner), so drop it and keep Tailwind for the stylesheet.
    viteFinal: async (viteConfig) => {
        const { default: tailwindcss } = await import("@tailwindcss/vite");
        // A Vite plugin entry may be a nested array or a promise — one factory
        // contributes several plugins — so the list has to be flattened and settled
        // before the names are legible. Filtering the raw list only ever sees the
        // outer array, which is how the React Router plugin survives to throw
        // "requires the use of a Vite config file" during a Storybook build.
        const settled = await Promise.all((viteConfig.plugins ?? []).flat(Number.POSITIVE_INFINITY));
        const plugins = settled.flat(Number.POSITIVE_INFINITY).filter((plugin) => {
            const name =
                plugin && typeof plugin === "object" && "name" in plugin
                    ? String((plugin as { name?: string }).name)
                    : "";
            return !name.startsWith("react-router");
        });
        return { ...viteConfig, plugins: [...plugins, tailwindcss()] };
    },
};

export default config;
