// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ReactNode } from "react";

// Original line-art icons, drawn as simple geometric paths so they carry no
// third-party licence — they are ours under 0BSD like the rest of the app, free to
// use and ship even once Plinky is paid for. Stroke follows currentColor, so each
// icon takes its button's text colour and theme.
function Icon({ children, className = "h-4 w-4" }: { children: ReactNode; className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

type IconProps = { className?: string };

// A filled triangle — the universal "play".
export function PlayIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
        </Icon>
    );
}

// A filled square — the universal "stop".
export function StopIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />
        </Icon>
    );
}

// Four corner brackets pointing outward — "go full screen".
export function MaximizeIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M16 3h3a2 2 0 0 1 2 2v3" />
            <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
        </Icon>
    );
}

// Four corner brackets pointing inward — "leave full screen".
export function MinimizeIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </Icon>
    );
}

export function PrinterIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M7 9V4h10v5" />
            <rect x="4" y="9" width="16" height="7" rx="1.5" />
            <rect x="7" y="14" width="10" height="6" rx="1" />
        </Icon>
    );
}

export function DownloadIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M12 4v10" />
            <path d="M8 11l4 4 4-4" />
            <path d="M5 19h14" />
        </Icon>
    );
}

export function ShareIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <circle cx="6" cy="12" r="2.4" />
            <circle cx="17" cy="6" r="2.4" />
            <circle cx="17" cy="18" r="2.4" />
            <path d="M8.1 10.9l6.8-3.8M8.1 13.1l6.8 3.8" />
        </Icon>
    );
}
