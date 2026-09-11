// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import type { Theme } from "../../../core/theme";
import { useThemeStore } from "../../contexts/services";
import { applyTheme } from "../../lib/theme";
import { m } from "../../paraglide/messages.js";

const ORDER: Theme[] = ["system", "light", "dark"];
// The picture sits outside the messages so the accessible name can carry the theme's
// translated name alone: a screen reader reads an emoji out by its description.
const THEMES: Record<Theme, { icon: string; label: () => string }> = {
    system: { icon: "🖥️", label: m.theme_system },
    light: { icon: "☀️", label: m.theme_light },
    dark: { icon: "🌙", label: m.theme_dark },
};

export function ThemeToggle() {
    const themeStore = useThemeStore();
    const [theme, setTheme] = useState<Theme>("system");

    useEffect(() => {
        setTheme(themeStore.load());
    }, [themeStore]);

    const cycle = () => {
        const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
        setTheme(next);
        themeStore.save(next);
        applyTheme(next);
    };

    return (
        <button
            type="button"
            onClick={cycle}
            aria-label={m.theme_aria({ theme: THEMES[theme].label() })}
            className="text-sm text-muted hover:text-ink"
        >
            {THEMES[theme].icon} {THEMES[theme].label()}
        </button>
    );
}
