// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, type KeyboardTheme, KEYBOARD_THEMES } from "../../core/keyboardTheme";
import { finishFor, type KeyboardFinish } from "../../core/keyboardFinish";
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

// The same, for how the keys are shaded. A second hook rather than one returning both,
// because one returning `{ theme, finish }` would build a new object every render and hand
// every keyboard a changed prop on every unrelated state change — the thing this file's
// id-snapshot exists to avoid.
export function useKeyboardFinish(): KeyboardFinish {
    const store = usePrefsStore();
    const id = useSyncExternalStore(
        store.subscribe,
        () => store.load().keyboardFinish,
        () => DEFAULT_PREFS.keyboardFinish,
    );
    return finishFor(id);
}
