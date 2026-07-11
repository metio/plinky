// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToggleIconButton } from "./toggleIconButton";

afterEach(cleanup);

describe("ToggleIconButton", () => {
    it("announces its pressed state and shows the accent only while on", () => {
        const { rerender } = render(
            <ToggleIconButton pressed={false} label="Finger numbers" onClick={() => {}}>
                <svg role="presentation" />
            </ToggleIconButton>,
        );
        const button = screen.getByRole("button", { name: "Finger numbers" });
        expect(button.getAttribute("aria-pressed")).toBe("false");
        expect(button.className).not.toContain("text-indigo-600");

        rerender(
            <ToggleIconButton pressed label="Finger numbers" onClick={() => {}}>
                <svg role="presentation" />
            </ToggleIconButton>,
        );
        expect(button.getAttribute("aria-pressed")).toBe("true");
        expect(button.className).toContain("text-indigo-600");
    });

    it("reports clicks", () => {
        const onClick = vi.fn();
        render(
            <ToggleIconButton pressed={false} label="Follow the note" onClick={onClick}>
                <svg role="presentation" />
            </ToggleIconButton>,
        );
        fireEvent.click(screen.getByRole("button", { name: "Follow the note" }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
