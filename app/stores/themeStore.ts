// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { parseTheme, type Theme } from "../../core/theme";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, type JsonStore } from "./jsonStore";

// The saved theme choice. The pre-paint bootstrap script in the app root reads
// the same key directly (it runs before React), so the key is exported for it.
export const THEME_STORAGE_KEY = "plinky:theme";

export type ThemeStore = JsonStore<Theme>;

export function createThemeStore(kv: KeyValueStore): ThemeStore {
    return createJsonStore(kv, THEME_STORAGE_KEY, (raw) => {
        if (raw === null) {
            return "system";
        }
        try {
            return parseTheme(JSON.parse(raw));
        } catch {
            return "system";
        }
    });
}

// The pre-paint bootstrap the app root inlines: sets the dark class from the
// saved (or OS) theme before first paint, so dark-mode users never see a light
// flash. The parse failure is contained to the parse — a corrupt stored value
// still falls through to the OS preference instead of skipping theming.
export function themeBootstrapScript(): string {
    return (
        "(function(){try{" +
        `var t=null;try{t=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}))}catch(e){}` +
        'if(t!=="light"&&t!=="dark"&&t!=="system"){t="system";}' +
        'if(t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))' +
        '{document.documentElement.classList.add("dark");}' +
        "}catch(e){}})();"
    );
}
