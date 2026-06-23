// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { getAudioContext } from "./audio";

describe("getAudioContext (browser)", () => {
    it("creates one shared AudioContext and reuses it", () => {
        const context = getAudioContext();
        expect(context).not.toBeNull();
        expect(getAudioContext()).toBe(context);
    });
});
