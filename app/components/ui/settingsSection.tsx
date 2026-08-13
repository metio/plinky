// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";

const CHIP: Record<"accent" | "danger", string> = {
    accent: "bg-accent-surface text-accent",
    danger: "bg-danger-surface text-danger",
};

// A titled block of related things. With an `icon` it renders as a card — the icon in a
// soft chip, a plain-language title and hint, the controls below — so each group of
// settings reads as one friendly, self-explaining unit.
//
// Without an icon it is the quiet variant: a small brass label over a hairline, which is
// how every labelled group in the app announces itself — the day's three moments, the
// groups inside a run's set-up panel, a panel nested in a settings card. One definition,
// so a reader learns the shape once. `level` keeps the document outline sound where it
// nests.
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
            <Heading className="border-b border-line pb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-spark-strong">
                {title}
            </Heading>
        );
        return (
            <section className="space-y-3">
                {hint === undefined ? (
                    heading
                ) : (
                    <div className="space-y-1.5">
                        {heading}
                        <p className="text-sm text-muted">{hint}</p>
                    </div>
                )}
                {children}
            </section>
        );
    }

    return (
        <section className="space-y-4 rounded-2xl border border-line bg-raised p-5 shadow-sm">
            <div className="flex items-start gap-3">
                <span
                    aria-hidden="true"
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${CHIP[tone]}`}
                >
                    {icon}
                </span>
                <div>
                    <Heading className="text-base font-semibold text-ink">{title}</Heading>
                    {hint !== undefined && <p className="text-sm text-muted">{hint}</p>}
                </div>
            </div>
            {children}
        </section>
    );
}
