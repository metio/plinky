// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    DEFAULT_PALETTE,
    DEFAULT_THEME,
    MODES,
    PALETTES,
    parseTheme,
    type Theme,
} from "../../core/theme";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, type JsonStore, parseJson } from "./jsonStore";

// The saved theme choice. The pre-paint bootstrap script in the app root reads
// the same key directly (it runs before React), so the key is exported for it.
export const THEME_STORAGE_KEY = "plinky:theme";

export type ThemeStore = JsonStore<Theme>;

export function createThemeStore(kv: KeyValueStore): ThemeStore {
    return createJsonStore(kv, THEME_STORAGE_KEY, (raw) =>
        parseJson(raw, DEFAULT_THEME, parseTheme),
    );
}

// The pre-paint bootstrap the app root inlines: stamps the saved (or OS) theme on the
// document before first paint, so nobody sees a flash of the wrong mode or palette. It
// does what applyTheme (app/lib/theme.ts) does, from what parseTheme reads — a bare
// stored string is a mode, each half falls back on its own — and themeStore.test.ts runs
// both over arbitrary stored values to hold them to the same answer. The parse failure is
// contained to the parse, so a corrupt stored value still falls through to the defaults
// instead of skipping theming.
export function themeBootstrapScript(): string {
    // The valid lists are embedded from core/theme, so the inline script can never
    // disagree with parseTheme about what counts as a saved choice.
    return (
        "(function(){try{" +
        "var d=document.documentElement,s=null;" +
        `try{s=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}))}catch(e){}` +
        'if(typeof s==="string"){s={mode:s};}' +
        'if(typeof s!=="object"||s===null){s={};}' +
        `var p=${JSON.stringify(PALETTES)}.indexOf(s.palette)<0?${JSON.stringify(DEFAULT_PALETTE)}:s.palette;` +
        `var m=${JSON.stringify(MODES)}.indexOf(s.mode)<0?"system":s.mode;` +
        'if(m==="system"){m=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}' +
        'if(m!=="light"){d.classList.add("dark");}' +
        'if(m==="black"){d.classList.add("black");}' +
        'd.setAttribute("data-palette",p);' +
        "}catch(e){}})();"
    );
}
