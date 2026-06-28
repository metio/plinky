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

// A tick — "connected / all good". Paired with a green tint, never an x.
export function CheckIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M5 13l4 4L19 7" />
        </Icon>
    );
}

// A two-prong plug — "a piano you can plug in". Shown muted when none is connected.
export function PlugIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M9 2v5M15 2v5" />
            <path d="M7 7h10v3a5 5 0 0 1-10 0z" />
            <path d="M12 15v4" />
        </Icon>
    );
}

// An X — "close" / "dismiss" / "remove".
export function CloseIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M6 6l12 12M18 6L6 18" />
        </Icon>
    );
}

// An up arrow — "move up" in an ordered list.
export function ArrowUpIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M12 19V5M6 11l6-6 6 6" />
        </Icon>
    );
}

// A down arrow — "move down" in an ordered list.
export function ArrowDownIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M12 5v14M6 13l6 6 6-6" />
        </Icon>
    );
}

// A star — a favourite. Filled when starred, outline when not.
export function StarIcon({ className, filled = false }: IconProps & { filled?: boolean }) {
    return (
        <Icon className={className}>
            <path
                d="M12 3.5l2.7 5.47 6.05.88-4.38 4.27 1.03 6.02L12 17.6l-5.4 2.54 1.03-6.02L3.25 9.85l6.05-.88z"
                fill={filled ? "currentColor" : "none"}
            />
        </Icon>
    );
}

// An arrow rising out of a tray — "upload" / drop a file to import.
export function UploadIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            <path d="M12 16V4M8 8l4-4 4 4" />
        </Icon>
    );
}

// A bulleted list — an ordered playlist / assignment.
export function ListIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M9 6h11M9 12h11M9 18h11" />
            <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
        </Icon>
    );
}

// A clock — "due for review".
export function ClockIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 8v4l3 2" />
        </Icon>
    );
}

// --- Navigation icons --------------------------------------------------------

// A house — "home".
export function HomeIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M3 11l9-7 9 7" />
            <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
            <path d="M10 20v-6h4v6" />
        </Icon>
    );
}

// A book — "the library".
export function BookIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M6 4h11a1 1 0 0 1 1 1v15H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
            <path d="M6 17h12" />
        </Icon>
    );
}

// Concentric rings around a centre — a target, for the daily challenge.
export function TargetIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="3.5" />
        </Icon>
    );
}

// A beamed pair of notes — "compose".
export function NotesIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M9 17V5l10-2v12" />
            <circle cx="6.5" cy="17" r="2.5" fill="currentColor" stroke="none" />
            <circle cx="16.5" cy="15" r="2.5" fill="currentColor" stroke="none" />
        </Icon>
    );
}

// A graduation cap — "you" / your grade.
export function GradCapIcon({ className }: IconProps) {
    return (
        <Icon className={className}>
            <path d="M2 9l10-4 10 4-10 4z" />
            <path d="M6 11v5c0 1.3 2.7 2.5 6 2.5s6-1.2 6-2.5v-5" />
        </Icon>
    );
}
