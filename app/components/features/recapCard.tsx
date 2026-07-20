// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { MonthlyRecap } from "../../../core/history";
import { SITE_URL } from "../../../core/site";
import { useCopied } from "../../hooks/useCopied";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";

// The month's name in the reader's language — "July 2026", "juillet 2026" — from Intl,
// so the twelve month names never need translating by hand. The day is fixed at the
// first so the parse lands squarely in the month whatever the runner's time zone.
function monthLabel(month: string): string {
    return new Intl.DateTimeFormat(getLocale(), { month: "long", year: "numeric" }).format(
        new Date(`${month}-01T00:00:00`),
    );
}

// A Wrapped-style card of the month's practice: the notes played, the days at the keys,
// and the biggest day, with one button to share it. A reward the You page offers when a
// month has practice to celebrate — never a reminder, never shown for an empty month.
export function RecapCard({ recap }: { recap: MonthlyRecap }) {
    const [copied, flashCopied] = useCopied();
    const heading = m.recap_heading({ month: monthLabel(recap.month) });

    const share = async () => {
        const text = `${heading} 🎹`;
        try {
            if (typeof navigator.share === "function") {
                await navigator.share({ text, url: SITE_URL });
            } else {
                await navigator.clipboard?.writeText(`${text} ${SITE_URL}`);
                flashCopied();
            }
        } catch {
            // A cancelled share or blocked clipboard needs no message.
        }
    };

    return (
        <section className="space-y-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-fuchsia-50 p-5 dark:border-indigo-800 dark:from-indigo-950 dark:to-fuchsia-950/40">
            <h3 className="font-semibold text-indigo-900 text-lg dark:text-indigo-100">
                {heading}
            </h3>
            <div className="flex gap-8">
                <Stat value={recap.totalNotes} label={m.progress_notes_played()} />
                <Stat value={recap.daysPracticed} label={m.progress_days_practiced()} />
            </div>
            {recap.bestDay && (
                <p className="text-gray-600 text-sm dark:text-gray-400">
                    {m.recap_best_day({ count: recap.bestDay.notes })}
                </p>
            )}
            <button
                type="button"
                onClick={share}
                className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-sm text-white transition hover:bg-indigo-500"
            >
                {copied ? m.share_copied() : m.recap_share()}
            </button>
        </section>
    );
}

function Stat({ value, label }: { value: number; label: string }) {
    return (
        <div>
            <div className="font-bold text-3xl text-indigo-700 tabular-nums dark:text-indigo-300">
                {value.toLocaleString(getLocale())}
            </div>
            <div className="text-gray-600 text-xs uppercase tracking-wide dark:text-gray-400">
                {label}
            </div>
        </div>
    );
}
