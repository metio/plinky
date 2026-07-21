// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useSyncExternalStore } from "react";
import { type KeyboardTheme, KEYBOARD_THEMES } from "../../../core/keyboardTheme";
import { DEFAULT_PREFS } from "../../../core/prefs";
import { usePrefsStore } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";

function themeName(id: string): string {
    switch (id) {
        case "sunset":
            return m.theme_sunset();
        case "forest":
            return m.theme_forest();
        case "berry":
            return m.theme_berry();
        default:
            return m.theme_classic();
    }
}

// A miniature keybed showing a skin's resting colours — three white keys with two black
// keys sitting over the gaps, the same shapes the real keyboard uses.
export function ThemeSwatch({ theme }: { theme: KeyboardTheme }) {
    return (
        <span className="relative flex h-10 w-16 gap-px overflow-hidden rounded border border-gray-300 dark:border-gray-600">
            {[0, 1, 2].map((key) => (
                <span key={key} className={`flex-1 ${theme.white}`} />
            ))}
            <span className={`absolute top-0 left-[27%] h-2/3 w-[14%] rounded-b ${theme.black}`} />
            <span className={`absolute top-0 left-[59%] h-2/3 w-[14%] rounded-b ${theme.black}`} />
        </span>
    );
}

// Pick the on-screen keyboard's skin. Every skin is free from the start — never anything
// but looks — so each is always selectable; the chosen one carries a ring.
export function KeyboardThemePicker() {
    const prefsStore = usePrefsStore();
    const chosen = useSyncExternalStore(
        prefsStore.subscribe,
        () => prefsStore.load().keyboardTheme,
        () => DEFAULT_PREFS.keyboardTheme,
    );

    return (
        // biome-ignore lint/a11y/useSemanticElements: a swatch chooser is a group of toggle buttons, not a fieldset
        <div role="group" aria-label={m.settings_keyboard_theme()} className="flex flex-wrap gap-3">
            {KEYBOARD_THEMES.map((theme) => {
                const active = chosen === theme.id;
                return (
                    <button
                        key={theme.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                            prefsStore.save({ ...prefsStore.load(), keyboardTheme: theme.id })
                        }
                        className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition ${
                            active
                                ? "border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-700"
                                : "border-gray-200 hover:border-indigo-300 dark:border-gray-700"
                        }`}
                    >
                        <ThemeSwatch theme={theme} />
                        <span className="font-medium text-gray-800 text-xs dark:text-gray-200">
                            {themeName(theme.id)}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
