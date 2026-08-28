// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSyncExternalStore } from "react";
import { KEYBOARD_FINISHES, type KeyboardFinish } from "../../../core/keyboardFinish";
import { DEFAULT_THEME, type KeyboardTheme, KEYBOARD_THEMES } from "../../../core/keyboardTheme";
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

// A miniature keybed: three white keys with two black keys over the gaps, the same shapes
// the real keyboard uses. One component for both choosers — a skin varies the colours and
// holds the shape, a finish varies the shape and holds the colour, and drawing that twice
// meant two answers to "what does a small keyboard look like".
function MiniKeybed({ white, black }: { white: string; black: string }) {
    return (
        <span className="relative flex h-10 w-16 gap-px overflow-hidden rounded border border-line-strong">
            {[0, 1, 2].map((key) => (
                <span key={key} className={`flex-1 ${white}`} />
            ))}
            <span className={`absolute top-0 left-[27%] h-2/3 w-[14%] ${black}`} />
            <span className={`absolute top-0 left-[59%] h-2/3 w-[14%] ${black}`} />
        </span>
    );
}

export function ThemeSwatch({ theme }: { theme: KeyboardTheme }) {
    return <MiniKeybed white={theme.white} black={`rounded-b ${theme.black}`} />;
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
                                ? "border-accent-ring ring-2 ring-accent-line-strong"
                                : "border-line hover:border-accent-line-strong"
                        }`}
                    >
                        <ThemeSwatch theme={theme} />
                        <span className="font-medium text-ink-soft text-xs">
                            {themeName(theme.id)}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

// Pick how the keys are shaded. Two looks rather than a slider: a player is choosing what
// the instrument should feel like, and "somewhere between flat and glossy" is not a thing
// anybody wants. The swatch shows the choice rather than naming it.
export function KeyboardFinishPicker() {
    const prefsStore = usePrefsStore();
    const chosen = useSyncExternalStore(
        prefsStore.subscribe,
        () => prefsStore.load().keyboardFinish,
        () => DEFAULT_PREFS.keyboardFinish,
    );

    return (
        // biome-ignore lint/a11y/useSemanticElements: a swatch chooser is a group of toggle buttons, not a fieldset
        <div
            role="group"
            aria-label={m.settings_keyboard_finish()}
            className="flex flex-wrap gap-3"
        >
            {KEYBOARD_FINISHES.map((finish) => {
                const active = chosen === finish.id;
                return (
                    <button
                        key={finish.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                            prefsStore.save({ ...prefsStore.load(), keyboardFinish: finish.id })
                        }
                        className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition ${
                            active
                                ? "border-accent-ring ring-2 ring-accent-line-strong"
                                : "border-line hover:border-accent-line-strong"
                        }`}
                    >
                        <FinishSwatch finish={finish} />
                        <span className="font-medium text-ink-soft text-xs">
                            {finish.id === "glossy" ? m.finish_glossy() : m.finish_joyful()}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

// The same keybed wearing a finish instead of a colour, so the two rows read as two
// questions about one instrument.
export function FinishSwatch({ finish }: { finish: KeyboardFinish }) {
    return (
        <MiniKeybed
            white={`${finish.whiteKey} ${DEFAULT_THEME.white}`}
            black={`${finish.blackKey} ${DEFAULT_THEME.black}`}
        />
    );
}
