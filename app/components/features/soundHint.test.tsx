// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { memoryStore } from "../../adapters/memoryStore";
import { createHintsStore } from "../../stores/hintsStore";
import { renderWithServices } from "../../testing/renderWithServices";
import { SoundHint } from "./soundHint";

// This suite renders many SoundHints that all carry role="status"; unmount each so
// a later query never collides with a leftover from the previous test.
afterEach(cleanup);

function tap() {
    act(() => {
        window.dispatchEvent(new Event("pointerdown"));
    });
}

describe("SoundHint", () => {
    it("shows nothing on a non-iOS device, even after a gesture", () => {
        renderWithServices(<SoundHint iosLike={false} inAppBrowser={false} />);
        tap();
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("stays hidden on iOS until the visitor has interacted", () => {
        renderWithServices(<SoundHint iosLike={true} inAppBrowser={false} />);
        expect(screen.queryByRole("status")).toBeNull();
        tap();
        // getByRole throws if the hint is absent, so reaching a truthy node is the pass.
        expect(screen.getByRole("status")).toBeTruthy();
    });

    it("gives the Silent Mode tip in a normal iOS browser", () => {
        renderWithServices(<SoundHint iosLike={true} inAppBrowser={false} />);
        tap();
        expect(screen.getByRole("status").textContent).toMatch(/silent mode/i);
    });

    it("points to Safari instead when inside a social app's in-app browser", () => {
        renderWithServices(<SoundHint iosLike={true} inAppBrowser={true} />);
        tap();
        expect(screen.getByRole("status").textContent).toMatch(/safari/i);
    });

    it("dismisses for good, remembering it in the hints store", () => {
        const hints = createHintsStore(memoryStore());
        renderWithServices(<SoundHint iosLike={true} inAppBrowser={false} />, { hints });
        tap();
        fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
        expect(screen.queryByRole("status")).toBeNull();
        expect(hints.seen("ios-sound")).toBe(true);
    });

    it("never reappears once already dismissed", () => {
        const hints = createHintsStore(memoryStore());
        hints.markSeen("ios-sound");
        renderWithServices(<SoundHint iosLike={true} inAppBrowser={false} />, { hints });
        tap();
        expect(screen.queryByRole("status")).toBeNull();
    });
});
