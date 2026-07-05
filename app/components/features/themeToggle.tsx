// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import type { Theme } from "../../../core/theme";
import { useThemeStore } from "../../contexts/services";
import { applyTheme } from "../../lib/theme";
import { m } from "../../paraglide/messages.js";

const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, () => string> = {
    system: m.theme_system,
    light: m.theme_light,
    dark: m.theme_dark,
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
            aria-label={m.theme_aria({ theme })}
            className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
            {LABEL[theme]()}
        </button>
    );
}
