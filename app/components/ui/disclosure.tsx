// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type ReactNode, useId, useState } from "react";
import { ChevronIcon } from "./icons";

// A disclosure whose panel grows to its own intrinsic height — the `grid-rows 0fr→1fr`
// trick, so there's no max-height to guess and no dead air on close. The content fades
// and settles a touch after the box starts opening (the small delay reads as "making
// room first"), and everything snaps under reduced-motion. A real `aria-expanded`
// button drives a `role="region"` panel, so the semantics stay clean for axe.
export function Disclosure({
    summary,
    defaultOpen = false,
    children,
}: {
    summary: ReactNode;
    defaultOpen?: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const panelId = useId();
    return (
        <div className="basis-full">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((value) => !value)}
                className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-indigo-700 dark:text-indigo-300"
            >
                <ChevronIcon
                    className={`h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none ${
                        open ? "rotate-90" : ""
                    }`}
                />
                {summary}
            </button>
            <div
                id={panelId}
                className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
            >
                {/* `min-h-0` is mandatory: without it the grid child keeps its implicit
                    `min-height: auto` and the `0fr` row can't collapse, so the panel
                    would render at full height — and conditional controls appearing once
                    the score loads would shift the page (a CLS regression). */}
                <div className="min-h-0 overflow-hidden">
                    {/* `inert` while closed keeps the collapsed-but-still-laid-out controls
                        out of the tab order and the accessibility tree, the way a native
                        <details> does — so keyboard focus never lands on a hidden control. */}
                    <div
                        inert={!open}
                        className={`space-y-4 pt-3 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
                            open ? "translate-y-0 opacity-100 delay-75" : "translate-y-1 opacity-0"
                        }`}
                    >
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

// One labelled cluster inside a control panel — a small uppercase heading and a hairline
// above (none for the first), so groups read by whitespace and rule rather than boxed
// cards that would fight the score for figure/ground.
export function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section className="border-t border-gray-200/70 pt-4 first:border-t-0 first:pt-0 dark:border-gray-800">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
            </h3>
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3">{children}</div>
        </section>
    );
}
