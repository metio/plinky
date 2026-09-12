// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { followRedraw } from "./followRedraw";

describe("followRedraw", () => {
    it("hands both transports the redraw's remap, and conceals and re-arms again", () => {
        const fresh = {} as SVGElement;
        const remap = () => fresh;
        const followers = {
            hidden: { reconceal: vi.fn() },
            vanishing: { rearm: vi.fn() },
            listenPlayback: { retarget: vi.fn() },
            keepUp: { retarget: vi.fn() },
        };
        followRedraw(followers, remap);
        expect(followers.listenPlayback.retarget).toHaveBeenCalledExactlyOnceWith(remap);
        expect(followers.keepUp.retarget).toHaveBeenCalledExactlyOnceWith(remap);
        expect(followers.hidden.reconceal).toHaveBeenCalledOnce();
        expect(followers.vanishing.rearm).toHaveBeenCalledOnce();
    });
});
