// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { applyTheme, loadTheme, saveTheme, type Theme } from "../../lib/theme";
import { m } from "../../paraglide/messages.js";

const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, () => string> = {
    system: m.theme_system,
    light: m.theme_light,
    dark: m.theme_dark,
};

export function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>("system");

    useEffect(() => {
        setTheme(loadTheme());
    }, []);

    const cycle = () => {
        const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
        setTheme(next);
        saveTheme(next);
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
