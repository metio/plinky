// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Disclosure, FieldGroup } from "./disclosure";

afterEach(cleanup);

describe("Disclosure", () => {
    it("starts closed and toggles aria-expanded", () => {
        render(
            <Disclosure summary="Tune">
                <p>controls</p>
            </Disclosure>,
        );
        const trigger = screen.getByRole("button", { name: /tune/i });
        expect(trigger.getAttribute("aria-expanded")).toBe("false");
        fireEvent.click(trigger);
        expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });

    it("respects defaultOpen", () => {
        render(
            <Disclosure summary="Tune" defaultOpen>
                <p>controls</p>
            </Disclosure>,
        );
        expect(screen.getByRole("button", { name: /tune/i }).getAttribute("aria-expanded")).toBe(
            "true",
        );
    });
});

describe("FieldGroup", () => {
    it("labels its cluster", () => {
        render(
            <FieldGroup label="Tempo">
                <span>slider</span>
            </FieldGroup>,
        );
        expect(screen.getByRole("heading", { name: "Tempo" })).toBeTruthy();
    });
});
