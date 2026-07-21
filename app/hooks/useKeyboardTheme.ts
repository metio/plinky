// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, type KeyboardTheme, KEYBOARD_THEMES } from "../../core/keyboardTheme";
import { DEFAULT_PREFS } from "../../core/prefs";
import { usePrefsStore } from "../contexts/services";

// Subscribe an on-screen keyboard to the chosen skin, so picking one in Settings reskins
// every keyboard at once without a reload. Snapshots the theme id (not the whole prefs
// object) so an unrelated preference save doesn't re-render a keyboard mid-play. The id
// is resolved here rather than in the store by a plain lookup, and an unknown id (a skin
// removed since it was chosen) falls back to classic.
export function useKeyboardTheme(): KeyboardTheme {
    const store = usePrefsStore();
    const id = useSyncExternalStore(
        store.subscribe,
        () => store.load().keyboardTheme,
        () => DEFAULT_PREFS.keyboardTheme,
    );
    return KEYBOARD_THEMES.find((theme) => theme.id === id) ?? DEFAULT_THEME;
}
