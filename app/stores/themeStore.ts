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
