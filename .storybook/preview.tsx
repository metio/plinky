// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Preview } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { MidiProvider } from "../app/contexts/midi";
import { localeNames } from "../core/locales";
import { locales, overwriteGetLocale } from "../app/paraglide/runtime.js";
import "../app/app.css";
// The app self-hosts Inter (see root.tsx); stories must render with the same
// face, or the story screenshots would rasterize whatever system font the
// machine happens to have — the one cross-machine difference we can remove.
import "@fontsource-variable/inter/wght.css";
// And the display face, which headings resolve to (--font-display in app.css). Without
// it a story renders titles in whatever serif the machine has, so the screenshots — and
// anything generated from them — show a typeface the app never ships.
import "@fontsource-variable/fredoka/wght.css";
import "@fontsource-variable/comfortaa/wght.css";
// Emoji too: the sans stack ends in "Noto Color Emoji", and this @font-face
// satisfies it with one pinned webfont — otherwise every emoji glyph comes
// from the OS, and Fedora's and ubuntu's system emoji draw differently.
import "@fontsource/noto-color-emoji";

// Screenshots need a still frame: freeze animations and transitions at their
// end state, and hide the text caret, so a story always rasterizes identically.
const FREEZE = `*, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
}`;

// Toolbar globals so any story can be viewed in any language and in light/dark.
const preview: Preview = {
    globalTypes: {
        locale: {
            description: "Language",
            toolbar: {
                icon: "globe",
                items: locales.map((locale) => ({
                    value: locale,
                    title: localeNames[locale] ?? locale,
                })),
                dynamicTitle: true,
            },
        },
        theme: {
            description: "Theme",
            toolbar: {
                icon: "circlehollow",
                items: [
                    { value: "light", title: "Light", icon: "sun" },
                    { value: "dark", title: "Dark", icon: "moon" },
                ],
                dynamicTitle: true,
            },
        },
    },
    initialGlobals: { locale: "en", theme: "light" },
    decorators: [
        // Components read the MIDI context and some render <Link>, so every story
        // gets a provider and an in-memory router. The toolbar globals drive
        // Paraglide's locale and the .dark class (see app.css).
        (Story, context) => {
            overwriteGetLocale(() => context.globals.locale ?? "en");
            document.documentElement.classList.toggle("dark", context.globals.theme === "dark");
            return (
                <MemoryRouter>
                    <MidiProvider>
                        <style>{FREEZE}</style>
                        <Story />
                    </MidiProvider>
                </MemoryRouter>
            );
        },
    ],
};

export default preview;
