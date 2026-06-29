// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { withDeniedStorage } from "./deniedStorage";
import { resetDevice } from "./resetDevice";

afterEach(() => localStorage.clear());

describe("resetDevice", () => {
    it("clears every plinky key and leaves others untouched", () => {
        localStorage.setItem("plinky:prefs", "{}");
        localStorage.setItem("plinky:mastery:scale-c-major", "{}");
        localStorage.setItem("plinky:scores", "[]");
        localStorage.setItem("other-app", "keep");

        const cleared = resetDevice();

        expect(cleared).toBe(3);
        expect(localStorage.getItem("plinky:prefs")).toBeNull();
        expect(localStorage.getItem("plinky:mastery:scale-c-major")).toBeNull();
        expect(localStorage.getItem("other-app")).toBe("keep");
    });

    it("clears nothing on a fresh device", () => {
        expect(resetDevice()).toBe(0);
    });
});

describe("resetDevice under denied storage", () => {
    it("clears nothing rather than throwing when storage is blocked", () => {
        expect(withDeniedStorage(() => resetDevice())).toBe(0);
    });
});
