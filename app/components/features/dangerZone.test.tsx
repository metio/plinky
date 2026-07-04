// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DangerZone } from "./dangerZone";

afterEach(cleanup);

describe("DangerZone", () => {
    it("asks to confirm before resetting, and backs out on cancel", () => {
        render(<DangerZone />);

        // The destructive action is one click away from a confirmation, not immediate.
        expect(screen.queryByRole("button", { name: /yes, erase/i })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /reset this device/i }));
        expect(screen.getByRole("button", { name: /yes, erase/i })).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
        expect(screen.queryByRole("button", { name: /yes, erase/i })).toBeNull();
    });
});
