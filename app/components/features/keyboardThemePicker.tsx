// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState, useSyncExternalStore } from "react";
import { type KeyboardTheme, KEYBOARD_THEMES, themeUnlocked } from "../../../core/keyboardTheme";
import { DEFAULT_PREFS } from "../../../core/prefs";
import { usePrefsStore, useServices } from "../../contexts/services";
import { currentGrade, loadGradedMastery } from "../../lib/gradeProgress";
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

// Pick the on-screen keyboard's skin. Each is unlocked by reaching a grade — a small
// reward for climbing, never anything but looks. A skin still beyond the player's grade
// shows locked with the grade it needs; the chosen one carries a ring.
export function KeyboardThemePicker() {
    const services = useServices();
    const prefsStore = usePrefsStore();
    const chosen = useSyncExternalStore(
        prefsStore.subscribe,
        () => prefsStore.load().keyboardTheme,
        () => DEFAULT_PREFS.keyboardTheme,
    );
    const [grade, setGrade] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        loadGradedMastery(services.mastery, services).then((items) => {
            if (!cancelled) {
                setGrade(currentGrade(items));
            }
        });
        return () => {
            cancelled = true;
        };
    }, [services]);

    return (
        // biome-ignore lint/a11y/useSemanticElements: a swatch chooser is a group of toggle buttons, not a fieldset
        <div role="group" aria-label={m.settings_keyboard_theme()} className="flex flex-wrap gap-3">
            {KEYBOARD_THEMES.map((theme) => {
                // Until the grade resolves, only the always-free skins are offered, so a
                // slow load never dangles a skin the player hasn't earned.
                const unlocked =
                    grade === null ? theme.unlockGrade === 0 : themeUnlocked(theme, grade);
                const active = chosen === theme.id;
                return (
                    <button
                        key={theme.id}
                        type="button"
                        aria-pressed={active}
                        disabled={!unlocked}
                        onClick={() =>
                            prefsStore.save({ ...prefsStore.load(), keyboardTheme: theme.id })
                        }
                        className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition disabled:opacity-50 ${
                            active
                                ? "border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-700"
                                : "border-gray-200 hover:border-indigo-300 dark:border-gray-700"
                        }`}
                    >
                        <ThemeSwatch theme={theme} />
                        <span className="font-medium text-gray-800 text-xs dark:text-gray-200">
                            {themeName(theme.id)}
                        </span>
                        {!unlocked && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                🔒 {m.grade_label({ level: theme.unlockGrade })}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
