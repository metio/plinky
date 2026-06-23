// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
        const plugins = (viteConfig.plugins ?? []).filter((plugin) => {
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
