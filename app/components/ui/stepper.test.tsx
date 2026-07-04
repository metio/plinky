// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Stepper } from "./stepper";

afterEach(cleanup);

describe("Stepper", () => {
    it("renders the value between labelled −/+ buttons and steps", () => {
        const onDecrement = vi.fn();
        const onIncrement = vi.fn();
        render(
            <Stepper
                value="+2"
                onDecrement={onDecrement}
                onIncrement={onIncrement}
                decrementLabel="Down"
                incrementLabel="Up"
            />,
        );
        expect(screen.getByText("+2")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Down" }));
        fireEvent.click(screen.getByRole("button", { name: "Up" }));
        expect(onDecrement).toHaveBeenCalledOnce();
        expect(onIncrement).toHaveBeenCalledOnce();
    });

    it("disables a button at its bound", () => {
        render(
            <Stepper
                value="−12"
                onDecrement={() => {}}
                onIncrement={() => {}}
                decrementLabel="Down"
                incrementLabel="Up"
                canDecrement={false}
            />,
        );
        expect(screen.getByRole("button", { name: "Down" }).hasAttribute("disabled")).toBe(true);
        expect(screen.getByRole("button", { name: "Up" }).hasAttribute("disabled")).toBe(false);
    });
});
