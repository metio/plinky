// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSyncExternalStore } from "react";
import {
    DEFAULT_THEME,
    type Mode,
    MODES,
    type Palette,
    PALETTES,
    type Theme,
} from "../../../core/theme";
import { useThemeStore } from "../../contexts/services";
import { applyTheme } from "../../lib/theme";
import { m } from "../../paraglide/messages.js";
import { ChoiceField } from "../ui/fields";

const MODE_NAMES: Record<Mode, () => string> = {
    system: m.theme_system,
    light: m.theme_light,
    dark: m.theme_dark,
    black: m.theme_black,
};

const PALETTE_NAMES: Record<Palette, () => string> = {
    indigo: m.palette_indigo,
    violet: m.palette_violet,
};

// Two questions, each with every answer in view: how dark, and which colours. They are
// independent — either palette in any mode — so one list of every pairing would ask the
// same thing eight ways.
export function ThemePicker() {
    const themeStore = useThemeStore();
    const theme = useSyncExternalStore(themeStore.subscribe, themeStore.load, () => DEFAULT_THEME);

    // Applied whether or not the write lands, so the choice holds for this visit even on a
    // device that refuses to store it; the storage-health banner speaks for the write.
    const choose = (next: Theme) => {
        themeStore.save(next);
        applyTheme(next);
    };

    return (
        <div className="space-y-4">
            <ChoiceField
                label={m.settings_theme()}
                value={theme.mode}
                onChange={(mode) => choose({ ...theme, mode })}
                options={MODES.map((id) => ({ id, label: MODE_NAMES[id]() }))}
            />
            <ChoiceField
                label={m.settings_palette()}
                value={theme.palette}
                onChange={(palette) => choose({ ...theme, palette })}
                options={PALETTES.map((id) => ({ id, label: PALETTE_NAMES[id]() }))}
            />
        </div>
    );
}
