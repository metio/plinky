// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ReactNode } from "react";

const CHIP: Record<"accent" | "danger", string> = {
    accent: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300",
    danger: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300",
};

// A titled block of related settings. With an `icon` it renders as a card — the
// icon in a soft chip, a plain-language title and hint, the controls below — so
// each group of settings reads as one friendly, self-explaining unit. Without an
// icon it is the quiet inline variant for a panel nested inside a card (Hand size
// under Fingering); `level` keeps the document outline sound there.
export function SettingsSection({
    title,
    hint,
    icon,
    tone = "accent",
    level = 2,
    children,
}: {
    title: string;
    hint?: string;
    icon?: ReactNode;
    tone?: "accent" | "danger";
    level?: 2 | 3;
    children: ReactNode;
}) {
    const Heading = level === 2 ? "h2" : "h3";

    if (icon === undefined) {
        const heading = (
            <Heading className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {title}
            </Heading>
        );
        return (
            <section className="space-y-3">
                {hint === undefined ? (
                    heading
                ) : (
                    <div>
                        {heading}
                        <p className="text-sm text-gray-500 dark:text-gray-400">{hint}</p>
                    </div>
                )}
                {children}
            </section>
        );
    }

    return (
        <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-3">
                <span
                    aria-hidden="true"
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${CHIP[tone]}`}
                >
                    {icon}
                </span>
                <div>
                    <Heading className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {title}
                    </Heading>
                    {hint !== undefined && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{hint}</p>
                    )}
                </div>
            </div>
            {children}
        </section>
    );
}
