// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ButtonHTMLAttributes, ReactNode } from "react";

// Shared button primitives. Plinky is touch-first, so every button clears the 44px
// minimum tap target, and the variants give each screen one dominant `primary` with
// quieter `secondary`/`ghost` around it (and `danger` for destructive actions) — so
// the main action reads as the main action and selectors don't masquerade as buttons.

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "plain";

const VARIANT: Record<ButtonVariant, string> = {
    primary:
        "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400",
    secondary:
        "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900",
    ghost: "text-indigo-700 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900",
    // red-700, not the brighter reds: white text needs it to clear the WCAG
    // 4.5:1 contrast ratio in both themes.
    danger: "bg-red-700 text-white hover:bg-red-800 dark:bg-red-700 dark:hover:bg-red-600",
    // Ghost's hover, but no text colour of its own — for a button that sets its own
    // colour to signal state (e.g. the learned toggle). Without tailwind-merge, a variant
    // that shipped its own text-* would fight the caller's, and same-property utilities
    // resolve by stylesheet order, not class-string order — so the caller could silently
    // lose. Owning no colour here leaves the caller's the only one, so it always wins.
    plain: "hover:bg-indigo-100 dark:hover:bg-indigo-900",
};

const BASE =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-50";

// The button look as a bare class string, for the cases that must render a different
// element than <button> — a react-router <Link> or a file-input <label> styled as a
// button — so they match the primitive without duplicating its Tailwind.
export function buttonClasses(variant: ButtonVariant = "secondary", className = ""): string {
    return `${BASE} ${VARIANT[variant]} ${className}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
};

export function Button({
    variant = "secondary",
    type = "button",
    className = "",
    children,
    ...rest
}: ButtonProps) {
    return (
        <button type={type} className={buttonClasses(variant, className)} {...rest}>
            {children}
        </button>
    );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    // Icon-only buttons have no visible text, so an accessible name is required.
    label: string;
    variant?: ButtonVariant;
    children: ReactNode;
};

// A 44px square for an icon with no visible label — the accessible name and tooltip
// both come from `label`.
export function IconButton({
    label,
    variant = "secondary",
    type = "button",
    className = "",
    children,
    ...rest
}: IconButtonProps) {
    return (
        <button
            type={type}
            aria-label={label}
            title={label}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors disabled:opacity-50 ${VARIANT[variant]} ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
}
