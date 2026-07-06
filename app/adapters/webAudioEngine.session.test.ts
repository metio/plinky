// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { preferPlaybackSession } from "./webAudioEngine";

// The Silent-Mode fix hinges on setting navigator.audioSession.type — the decision
// takes the navigator as an argument precisely so it can be exercised here without a
// real browser or a WebKit-only global.
describe("preferPlaybackSession", () => {
    it("switches a WebKit audio session to the playback type", () => {
        const session = { type: "auto" };
        expect(preferPlaybackSession({ audioSession: session })).toBe(true);
        expect(session.type).toBe("playback");
    });

    it("reports no session on a browser without the API", () => {
        expect(preferPlaybackSession({})).toBe(false);
        expect(preferPlaybackSession(null)).toBe(false);
        expect(preferPlaybackSession(undefined)).toBe(false);
    });

    it("stays quiet when the session type is read-only rather than throwing out", () => {
        const session = Object.freeze({ type: "auto" });
        // A frozen setter throws in strict mode; the helper must swallow it.
        expect(preferPlaybackSession({ audioSession: session })).toBe(false);
        expect(session.type).toBe("auto");
    });
});
