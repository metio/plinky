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

    it("marks the collapsed panel inert so hidden controls aren't focusable", () => {
        render(
            <Disclosure summary="Tune">
                <button type="button">Inside</button>
            </Disclosure>,
        );
        // Closed: the content lives in an inert subtree, the way native <details> hides it.
        expect(screen.getByText("Inside").closest("[inert]")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /tune/i }));
        expect(screen.getByText("Inside").closest("[inert]")).toBeNull();
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
