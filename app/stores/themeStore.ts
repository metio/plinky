// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { parseTheme, THEMES, type Theme } from "../../core/theme";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, type JsonStore, parseJson } from "./jsonStore";

// The saved theme choice. The pre-paint bootstrap script in the app root reads
// the same key directly (it runs before React), so the key is exported for it.
export const THEME_STORAGE_KEY = "plinky:theme";

export type ThemeStore = JsonStore<Theme>;

export function createThemeStore(kv: KeyValueStore): ThemeStore {
    return createJsonStore(kv, THEME_STORAGE_KEY, (raw) => parseJson(raw, "system", parseTheme));
}

// The pre-paint bootstrap the app root inlines: sets the dark class from the
// saved (or OS) theme before first paint, so dark-mode users never see a light
// flash. The parse failure is contained to the parse — a corrupt stored value
// still falls through to the OS preference instead of skipping theming.
export function themeBootstrapScript(): string {
    // The valid-theme list is embedded from core/theme, so the inline script can
    // never disagree with parseTheme about what counts as a saved choice.
    return (
        "(function(){try{" +
        `var t=null;try{t=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}))}catch(e){}` +
        `if(${JSON.stringify(THEMES)}.indexOf(t)<0){t="system";}` +
        'if(t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))' +
        '{document.documentElement.classList.add("dark");}' +
        "}catch(e){}})();"
    );
}
