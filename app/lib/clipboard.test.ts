// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("copyText", () => {
    it("confirms a write that landed", async () => {
        const writeText = vi.fn(async () => {});
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        await expect(copyText("code")).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith("code");
    });

    it("does not confirm where there is no clipboard to write to", async () => {
        vi.stubGlobal("navigator", {});
        await expect(copyText("code")).resolves.toBe(false);
    });

    it("does not confirm a write the browser refused", async () => {
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: async () => {
                    throw new Error("denied");
                },
            },
        });
        await expect(copyText("code")).resolves.toBe(false);
    });
});
