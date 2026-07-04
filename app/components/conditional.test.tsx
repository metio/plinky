// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MidiDevice } from "../../core/midi";
import { FullscreenProvider, FullScreen, Media, Midi, Show, useMidiConnected } from "./conditional";

const { connectionMock } = vi.hoisted(() => ({ connectionMock: vi.fn() }));
vi.mock("../contexts/midi", () => ({ useMidiConnection: connectionMock }));

const device: MidiDevice = { id: "1", name: "Piano", manufacturer: "", state: "connected" };

function setConnection(value: { support: string; status: string; devices: MidiDevice[] }) {
    connectionMock.mockReturnValue(value);
}

function stubMatchMedia(matches: boolean): void {
    vi.stubGlobal("matchMedia", () => ({
        matches,
        addEventListener() {},
        removeEventListener() {},
    }));
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("Show", () => {
    it("renders children when the condition holds, the fallback otherwise", () => {
        const { rerender } = render(
            <Show when={true} fallback={<span>no</span>}>
                <span>yes</span>
            </Show>,
        );
        expect(screen.queryByText("yes")).toBeTruthy();
        expect(screen.queryByText("no")).toBeNull();
        rerender(
            <Show when={false} fallback={<span>no</span>}>
                <span>yes</span>
            </Show>,
        );
        expect(screen.queryByText("yes")).toBeNull();
        expect(screen.queryByText("no")).toBeTruthy();
    });

    it("renders nothing and no fallback by default when the condition is false", () => {
        const { container } = render(<Show when={0}>{<span>x</span>}</Show>);
        expect(container.textContent).toBe("");
    });

    it("evaluates only the taken branch when each side is a thunk", () => {
        const taken = vi.fn(() => <span>taken</span>);
        const skipped = vi.fn(() => <span>skipped</span>);
        render(
            <Show when={true} fallback={skipped}>
                {taken}
            </Show>,
        );
        // The thunk restores `flag && …` short-circuiting: the untaken branch — an
        // expensive inline computation in real use — is never run.
        expect(taken).toHaveBeenCalledTimes(1);
        expect(skipped).not.toHaveBeenCalled();
    });
});

describe("FullScreen", () => {
    const wrap = (active: boolean) =>
        render(
            <FullscreenProvider active={active}>
                <FullScreen>
                    <span>in</span>
                </FullScreen>
                <FullScreen off>
                    <span>out</span>
                </FullScreen>
            </FullscreenProvider>,
        );

    it("shows only the in-full-screen branch while active", () => {
        wrap(true);
        expect(screen.queryByText("in")).toBeTruthy();
        expect(screen.queryByText("out")).toBeNull();
    });

    it("shows only the off branch when not full screen", () => {
        wrap(false);
        expect(screen.queryByText("in")).toBeNull();
        expect(screen.queryByText("out")).toBeTruthy();
    });

    it("treats no provider as not full screen", () => {
        render(
            <FullScreen off>
                <span>out</span>
            </FullScreen>,
        );
        expect(screen.queryByText("out")).toBeTruthy();
    });
});

describe("Midi", () => {
    it("matches the connected state and its inverse", () => {
        setConnection({ support: "supported", status: "ready", devices: [device] });
        render(
            <>
                <Midi connected>
                    <span>on</span>
                </Midi>
                <Midi disconnected>
                    <span>off</span>
                </Midi>
            </>,
        );
        expect(screen.queryByText("on")).toBeTruthy();
        expect(screen.queryByText("off")).toBeNull();
    });

    it("matches browser support independent of a connected device", () => {
        setConnection({ support: "unsupported", status: "idle", devices: [] });
        render(
            <>
                <Midi unsupported>
                    <span>no-webmidi</span>
                </Midi>
                <Midi disconnected>
                    <span>none</span>
                </Midi>
            </>,
        );
        expect(screen.queryByText("no-webmidi")).toBeTruthy();
        expect(screen.queryByText("none")).toBeTruthy();
    });

    it("derives the connected flag the same way through the shared hook", () => {
        setConnection({ support: "supported", status: "ready", devices: [device] });
        expect(renderHook(() => useMidiConnected()).result.current).toBe(true);
        setConnection({ support: "supported", status: "ready", devices: [] });
        expect(renderHook(() => useMidiConnected()).result.current).toBe(false);
    });
});

describe("Media", () => {
    it("renders while the query matches", () => {
        stubMatchMedia(true);
        render(
            <Media query="(max-width: 639px)">
                <span>narrow</span>
            </Media>,
        );
        expect(screen.queryByText("narrow")).toBeTruthy();
    });

    it("inverts with the not prop", () => {
        stubMatchMedia(true);
        render(
            <Media query="(max-width: 639px)" not>
                <span>wide</span>
            </Media>,
        );
        expect(screen.queryByText("wide")).toBeNull();
    });
});
