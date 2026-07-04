// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_PREFS } from "../../../core/prefs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discoveries } from "../../lib/onboarding";
import { PlayModeBar } from "./playModeBar";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("PlayModeBar", () => {
    it("marks the active mode and reports a switch", () => {
        const onChange = vi.fn();
        render(<PlayModeBar mode="play" onChange={onChange} />);

        expect(screen.getByRole("tab", { name: "Play" }).getAttribute("aria-selected")).toBe(
            "true",
        );
        expect(screen.getByRole("tab", { name: "Ear" }).getAttribute("aria-selected")).toBe(
            "false",
        );

        fireEvent.click(screen.getByRole("tab", { name: "Finger Position" }));
        expect(onChange).toHaveBeenCalledWith("fingering");
    });

    it("records reaching Ear and Fingering for the discovery checklist", () => {
        render(<PlayModeBar mode="play" onChange={vi.fn()} />);
        expect(discoveries({ prefs: DEFAULT_PREFS, masteredCount: 0, history: {} }).earTried).toBe(
            false,
        );

        fireEvent.click(screen.getByRole("tab", { name: "Ear" }));
        expect(discoveries({ prefs: DEFAULT_PREFS, masteredCount: 0, history: {} }).earTried).toBe(
            true,
        );

        fireEvent.click(screen.getByRole("tab", { name: "Finger Position" }));
        expect(
            discoveries({ prefs: DEFAULT_PREFS, masteredCount: 0, history: {} }).fingeringTried,
        ).toBe(true);
    });
});
