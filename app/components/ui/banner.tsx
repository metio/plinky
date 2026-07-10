// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { AriaRole, ReactNode } from "react";
import { CloseIcon } from "./icons";

// The tone decides every colour in the banner. Each entry spells out the full
// literal class strings — the Tailwind gate compiles class names verbatim, so
// no fragment may be assembled dynamically.
const tones = {
    amber: {
        shell: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950",
        text: "text-amber-900 dark:text-amber-200",
        dismiss:
            "text-amber-900 hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100",
    },
    indigo: {
        shell: "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950",
        text: "text-indigo-900 dark:text-indigo-200",
        dismiss:
            "text-indigo-900 hover:text-indigo-700 dark:text-indigo-200 dark:hover:text-indigo-100",
    },
    sky: {
        shell: "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950",
        text: "text-sky-900 dark:text-sky-200",
        dismiss: "text-sky-900 hover:text-sky-700 dark:text-sky-200 dark:hover:text-sky-100",
    },
} as const;

export type BannerTone = keyof typeof tones;

// A dismissible edge-to-edge notice pinned under the header: tinted strip,
// centred content column, a close button on the right. The caller owns the
// visibility logic and any persistence of the dismissal — this only renders
// the strip and reports the click. `actions` sit between the message and the
// close button; `footer` adds a second row under the message (share buttons,
// details), which switches the strip to its taller, top-aligned layout.
export function Banner({
    tone,
    role = "status",
    onDismiss,
    dismissLabel,
    actions,
    footer,
    emphasis = false,
    children,
}: {
    tone: BannerTone;
    role?: AriaRole;
    onDismiss: () => void;
    dismissLabel: string;
    actions?: ReactNode;
    footer?: ReactNode;
    // Renders the message as a bold heading — for celebratory notices whose
    // message titles the content below rather than being the whole story.
    emphasis?: boolean;
    children: ReactNode;
}) {
    const palette = tones[tone];
    return (
        <div role={role} className={`border-b px-6 ${footer ? "py-3" : "py-2"} ${palette.shell}`}>
            <div className={`mx-auto max-w-3xl ${footer ? "space-y-2" : ""}`}>
                <div
                    className={`flex ${footer ? "items-start" : "items-center"} justify-between gap-4`}
                >
                    <p className={`text-sm ${emphasis ? "font-semibold " : ""}${palette.text}`}>
                        {children}
                    </p>
                    <div className="flex shrink-0 items-center gap-3">
                        {actions}
                        <button
                            type="button"
                            onClick={onDismiss}
                            aria-label={dismissLabel}
                            className={palette.dismiss}
                        >
                            <CloseIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                {footer}
            </div>
        </div>
    );
}
