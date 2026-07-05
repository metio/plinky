// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserStore } from "../../adapters/browserStore";
import { createOnboardingStore } from "../../stores/onboardingStore";
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
        // The bar renders on the default services (real browser storage in jsdom), so
        // a fresh store over the same backing reads what the clicks marked.
        const marked = () => createOnboardingStore(browserStore).marked();
        render(<PlayModeBar mode="play" onChange={vi.fn()} />);
        expect(marked().has("earTried")).toBe(false);

        fireEvent.click(screen.getByRole("tab", { name: "Ear" }));
        expect(marked().has("earTried")).toBe(true);

        fireEvent.click(screen.getByRole("tab", { name: "Finger Position" }));
        expect(marked().has("fingeringTried")).toBe(true);
    });
});
