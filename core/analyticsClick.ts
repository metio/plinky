// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The attributes of a clicked control the analytics needs to name it — extracted from
// the DOM by the app layer and passed here as plain data, so the naming logic stays a
// pure, testable function. Nothing here is user data: only the control's own label.
export type ClickTarget = {
    // An explicit `data-analytics` label wins when a control's visible text would be
    // unhelpful or too variable.
    dataAnalytics?: string | null;
    ariaLabel?: string | null;
    text?: string | null;
    title?: string | null;
    // The lowercase tag name (button, a, summary…) — the last-resort label and the
    // default control kind.
    tag: string;
    // The ARIA role, when set (button, switch, tab…): the control kind if present.
    role?: string | null;
};

export type ClickInfo = { label: string; control: string };

// Labels are capped so a click on a whole card (its text is the label of last resort)
// can't send a paragraph to analytics.
const MAX_LABEL = 80;
const clean = (value: string): string => value.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL);

// Name a clicked control for a "click" event: the most specific human label available
// (an explicit data-analytics label, else the accessible name, else the visible text,
// else the title, else the tag) and the control kind (its role, else its tag). Returns
// null only when nothing at all identifies it.
export function clickInfo(target: ClickTarget): ClickInfo | null {
    const label =
        pick(target.dataAnalytics) ??
        pick(target.ariaLabel) ??
        pick(target.text) ??
        pick(target.title) ??
        target.tag;
    if (label === "") {
        return null;
    }
    return { label, control: pick(target.role) ?? target.tag };
}

function pick(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const cleaned = clean(value);
    return cleaned === "" ? null : cleaned;
}
