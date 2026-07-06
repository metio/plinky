// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { isIosLike } from "./platform";

const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD_OS =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const ANDROID =
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

describe("isIosLike", () => {
    it("matches an iPhone user agent", () => {
        expect(isIosLike(IPHONE, 5)).toBe(true);
    });

    it("matches iPadOS, which masquerades as a Mac but reports touch points", () => {
        expect(isIosLike(IPAD_OS, 5)).toBe(true);
    });

    it("rejects a real Mac with no touch, despite the shared Macintosh token", () => {
        expect(isIosLike(MAC, 0)).toBe(false);
    });

    it("does not treat a touch Android device as iOS", () => {
        expect(isIosLike(ANDROID, 5)).toBe(false);
    });
});
