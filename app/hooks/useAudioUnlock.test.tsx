// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { ServicesProvider } from "../contexts/services";
import { useAudioUnlock } from "./useAudioUnlock";

// Unmount each hook so its window listeners never linger into the next test.
afterEach(cleanup);

function harness() {
    const audio = fakeAudioEngine();
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ audio }}>{children}</ServicesProvider>
    );
    const { result, unmount } = renderHook(() => useAudioUnlock(), { wrapper });
    return { audio, result, unmount };
}

describe("useAudioUnlock", () => {
    it("starts un-interacted and unlocks audio on the first gesture", () => {
        const { audio, result } = harness();
        expect(result.current).toBe(false);
        expect(audio.unlocked).toBe(0);

        act(() => {
            window.dispatchEvent(new Event("pointerdown"));
        });

        expect(result.current).toBe(true);
        expect(audio.unlocked).toBe(1);
    });

    it("re-unlocks on every later gesture, so a post-interruption tap recovers audio", () => {
        const { audio } = harness();
        act(() => {
            window.dispatchEvent(new Event("pointerdown"));
            window.dispatchEvent(new Event("keydown"));
            window.dispatchEvent(new Event("touchend"));
        });
        expect(audio.unlocked).toBe(3);
    });

    it("re-wakes audio when the tab returns to the foreground, without counting as engagement", () => {
        const { audio, result } = harness();
        // jsdom reports document as visible, so the handler takes the wake path.
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        expect(audio.unlocked).toBe(1);
        // Foreground return is not a user gesture, so the hint gate stays closed.
        expect(result.current).toBe(false);
    });

    it("stops listening once unmounted", () => {
        const { audio, unmount } = harness();
        unmount();
        act(() => {
            window.dispatchEvent(new Event("pointerdown"));
        });
        expect(audio.unlocked).toBe(0);
    });
});
