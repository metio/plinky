// @vitest-environment jsdom
// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { classifyMicError, micPitch } from "./micPitch";

describe("classifyMicError", () => {
    it("reads a refused permission prompt as denied", () => {
        expect(classifyMicError(new DOMException("Permission denied", "NotAllowedError"))).toBe(
            "denied",
        );
    });

    it("reads every other getUserMedia failure as an error", () => {
        expect(
            classifyMicError(new DOMException("Requested device not found", "NotFoundError")),
        ).toBe("error");
        expect(classifyMicError(new DOMException("Device in use", "NotReadableError"))).toBe(
            "error",
        );
    });

    it("reads a non-DOMException rejection as an error", () => {
        expect(classifyMicError(new Error("NotAllowedError"))).toBe("error");
        expect(classifyMicError("NotAllowedError")).toBe("error");
        expect(classifyMicError(undefined)).toBe("error");
    });
});

describe("micPitch", () => {
    it("reports unsupported where the browser exposes no capture device", () => {
        expect(micPitch().supported()).toBe(false);
    });

    // stop() before start() is the teardown a component runs on unmount whether
    // or not the mic ever opened.
    it("stops idempotently without ever having started", () => {
        const input = micPitch();

        expect(() => {
            input.stop();
            input.stop();
        }).not.toThrow();
    });
});
