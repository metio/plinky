// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmButton } from "./confirmButton";

afterEach(cleanup);

describe("ConfirmButton", () => {
    it("fires only on the second, confirming click", () => {
        const onConfirm = vi.fn();
        render(
            <ConfirmButton onConfirm={onConfirm} confirmLabel="Clear all?">
                Clear
            </ConfirmButton>,
        );
        fireEvent.click(screen.getByRole("button", { name: "Clear" }));
        expect(onConfirm).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Clear all?" }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("disarms without firing when cancelled", () => {
        const onConfirm = vi.fn();
        render(
            <ConfirmButton onConfirm={onConfirm} confirmLabel="Clear all?">
                Clear
            </ConfirmButton>,
        );
        fireEvent.click(screen.getByRole("button", { name: "Clear" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onConfirm).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
    });

    it("renders an icon trigger named by its label, then swaps in the confirm", () => {
        const onConfirm = vi.fn();
        render(
            <ConfirmButton onConfirm={onConfirm} confirmLabel="Remove?" label="Remove">
                <span>icon</span>
            </ConfirmButton>,
        );
        fireEvent.click(screen.getByRole("button", { name: "Remove" }));
        fireEvent.click(screen.getByRole("button", { name: "Remove?" }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
