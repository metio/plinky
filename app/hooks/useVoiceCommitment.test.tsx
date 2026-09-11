// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { memoryStore } from "../adapters/memoryStore";
import { ServicesProvider } from "../contexts/services";
import { createPrefsStore } from "../stores/prefsStore";
import { useVoiceCommitment } from "./useVoiceCommitment";

function harness(performing: boolean) {
    const audio = fakeAudioEngine();
    const prefs = createPrefsStore(memoryStore());
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ prefs, audio }}>{children}</ServicesProvider>
    );
    const view = renderHook(({ on }) => useVoiceCommitment(on), {
        wrapper,
        initialProps: { on: performing },
    });
    return { audio, ...view };
}

describe("useVoiceCommitment", () => {
    it("keeps a run's instrument while the run plays", () => {
        const { audio, rerender } = harness(false);
        audio.commitVoice();
        rerender({ on: true });
        expect(audio.holdingVoice).toBe(true);
    });

    it("lets it go when the run ends", () => {
        const { audio, rerender } = harness(true);
        audio.commitVoice();
        rerender({ on: false });
        expect(audio.holdingVoice).toBe(false);
    });

    it("lets it go when the page is left mid-run", () => {
        const { audio, unmount } = harness(true);
        audio.commitVoice();
        unmount();
        expect(audio.holdingVoice).toBe(false);
    });
});
