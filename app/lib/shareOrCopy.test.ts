// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { shareOrCopy } from "./shareOrCopy";

const withNavigator = (nav: Partial<Navigator>) => {
    vi.stubGlobal("navigator", nav as Navigator);
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("shareOrCopy", () => {
    it("uses the native sheet where there is one, and does not claim to have copied", () => {
        // A share sheet says its own piece; a "copied!" underneath it is a lie about what
        // happened.
        const share = vi.fn().mockResolvedValue(undefined);
        const writeText = vi.fn();
        const onCopied = vi.fn();
        withNavigator({ share, clipboard: { writeText } as unknown as Clipboard });
        return shareOrCopy({ share: { url: "u", text: "t" }, copy: "c", onCopied }).then(() => {
            expect(share).toHaveBeenCalledWith({ url: "u", text: "t" });
            expect(writeText).not.toHaveBeenCalled();
            expect(onCopied).not.toHaveBeenCalled();
        });
    });

    it("falls back to the clipboard and confirms, with what the caller asked to copy", () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        const onCopied = vi.fn();
        withNavigator({ clipboard: { writeText } as unknown as Clipboard });
        return shareOrCopy({ share: { url: "u" }, copy: "sentence and site", onCopied }).then(
            () => {
                expect(writeText).toHaveBeenCalledWith("sentence and site");
                expect(onCopied).toHaveBeenCalledTimes(1);
            },
        );
    });

    it("does not confirm a copy the clipboard refused", async () => {
        // Flashing "copied" over a blocked clipboard sends somebody off to paste nothing.
        const writeText = vi.fn().mockRejectedValue(new Error("blocked"));
        const onCopied = vi.fn();
        withNavigator({ clipboard: { writeText } as unknown as Clipboard });
        await shareOrCopy({ share: { url: "u" }, copy: "c", onCopied });
        expect(onCopied).not.toHaveBeenCalled();
    });

    it("swallows a cancelled share — changing your mind is not an error", async () => {
        const share = vi.fn().mockRejectedValue(new Error("AbortError"));
        const onCopied = vi.fn();
        withNavigator({ share, clipboard: { writeText: vi.fn() } as unknown as Clipboard });
        await expect(
            shareOrCopy({ share: { url: "u" }, copy: "c", onCopied }),
        ).resolves.toBeUndefined();
        expect(onCopied).not.toHaveBeenCalled();
    });

    it("survives a browser with no clipboard at all, and does not claim to have copied", async () => {
        const onCopied = vi.fn();
        withNavigator({});
        await expect(
            shareOrCopy({ share: { url: "u" }, copy: "c", onCopied }),
        ).resolves.toBeUndefined();
        expect(onCopied).not.toHaveBeenCalled();
    });
});
