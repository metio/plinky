// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { createContext, type ReactNode, useContext } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useMidiConnection } from "../contexts/midi";

// Declarative conditional rendering. A run of `{flag && (<…>)}` / `{!flag && (<…>)}`
// guards is hard to read once several stack up and the same flag drives many of
// them; these components name the condition instead, so the branch reads like a
// sentence and the flag is written once.
//
// Children may be a node or a thunk. A node is the common case — a child element's
// body isn't run until it's actually rendered, so wrapping is already lazy. Pass a
// `() => …` thunk when the children hold expensive *inline* work (a `.map`, a
// filter): the thunk is only called on the branch that's taken, restoring the
// short-circuit `flag && …` skips on its own.
export type Renderable = ReactNode | (() => ReactNode);

function render(renderable: Renderable): ReactNode {
    return typeof renderable === "function" ? renderable() : renderable;
}

// Renders `children` when `when` is truthy, otherwise `fallback` (the else branch).
// Only the taken branch is evaluated, so a thunk on either side stays lazy.
export function Show({
    when,
    children,
    fallback = null,
}: {
    when: unknown;
    children: Renderable;
    fallback?: Renderable;
}) {
    return <>{when ? render(children) : render(fallback)}</>;
}

// Full-screen play state, supplied by FullscreenProvider so the <FullScreen> guard
// reads it from context rather than every guard taking the same flag as a prop. The
// default (false) lets the guard render sensibly even outside a provider.
const FullscreenContext = createContext(false);

export function FullscreenProvider({ active, children }: { active: boolean; children: ReactNode }) {
    return <FullscreenContext.Provider value={active}>{children}</FullscreenContext.Provider>;
}

export function useFullscreenActive(): boolean {
    return useContext(FullscreenContext);
}

// Renders its children only in (or, with `off`, only out of) full-screen play.
export function FullScreen({
    off = false,
    children,
    fallback = null,
}: {
    off?: boolean;
    children: Renderable;
    fallback?: Renderable;
}) {
    const active = useFullscreenActive();
    return <>{(off ? !active : active) ? render(children) : render(fallback)}</>;
}

// Whether a MIDI instrument is connected and ready — the one derivation the badge,
// the connect prompt and the trainer all share, kept here so they can't drift.
export function useMidiConnected(): boolean {
    const { status, devices } = useMidiConnection();
    return status === "ready" && devices.length > 0;
}

// Renders its children for one MIDI state: a ready instrument (`connected`), none
// (`disconnected`), or whether the browser exposes Web MIDI at all (`supported` /
// `unsupported`). Exactly one flag is meant to be set.
export function Midi({
    connected,
    disconnected,
    supported,
    unsupported,
    children,
    fallback = null,
}: {
    connected?: boolean;
    disconnected?: boolean;
    supported?: boolean;
    unsupported?: boolean;
    children: Renderable;
    fallback?: Renderable;
}) {
    const { support, status, devices } = useMidiConnection();
    const isConnected = status === "ready" && devices.length > 0;
    const active =
        (connected && isConnected) ||
        (disconnected && !isConnected) ||
        (supported && support === "supported") ||
        (unsupported && support === "unsupported");
    return <>{active ? render(children) : render(fallback)}</>;
}

// Renders its children while a CSS media query matches (or, with `not`, while it
// doesn't) — a declarative read of the same `useMediaQuery` the layout already uses.
export function Media({
    query,
    not = false,
    children,
    fallback = null,
}: {
    query: string;
    not?: boolean;
    children: Renderable;
    fallback?: Renderable;
}) {
    const matches = useMediaQuery(query);
    return <>{(not ? !matches : matches) ? render(children) : render(fallback)}</>;
}
