// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { withDeniedStorage } from "../testing/deniedStorage";
import { browserStore } from "../adapters/browserStore";
import { resetDevice } from "./resetDevice";

afterEach(() => localStorage.clear());

describe("resetDevice", () => {
    it("clears every klimpi key and leaves others untouched", () => {
        localStorage.setItem("klimpi:prefs", "{}");
        localStorage.setItem("klimpi:mastery:scale-c-major", "{}");
        localStorage.setItem("klimpi:scores", "[]");
        localStorage.setItem("other-app", "keep");

        const cleared = resetDevice(browserStore);

        expect(cleared).toBe(3);
        expect(localStorage.getItem("klimpi:prefs")).toBeNull();
        expect(localStorage.getItem("klimpi:mastery:scale-c-major")).toBeNull();
        expect(localStorage.getItem("other-app")).toBe("keep");
    });

    it("clears nothing on a fresh device", () => {
        expect(resetDevice(browserStore)).toBe(0);
    });
});

describe("resetDevice under denied storage", () => {
    it("clears nothing rather than throwing when storage is blocked", () => {
        expect(withDeniedStorage(() => resetDevice(browserStore))).toBe(0);
    });
});
