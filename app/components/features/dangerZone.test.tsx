// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { memoryStore } from "../../adapters/memoryStore";
import { renderWithServices } from "../../testing/renderWithServices";
import { m } from "../../paraglide/messages.js";
import { DangerZone } from "./dangerZone";

afterEach(cleanup);

describe("DangerZone", () => {
    it("asks to confirm before resetting, and backs out on cancel", () => {
        render(<DangerZone />);

        // The destructive action is one click away from a confirmation, not immediate.
        expect(screen.queryByRole("button", { name: m.settings_reset_yes() })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: m.settings_reset() }));
        expect(screen.getByRole("button", { name: m.settings_reset_yes() })).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: m.action_cancel() }));
        expect(screen.queryByRole("button", { name: m.settings_reset_yes() })).toBeNull();
    });

    it("reports a failed wipe instead of reloading when storage refuses removals", () => {
        // A store that keeps a Plinky key however hard it is told to delete it — the
        // reset must surface the failure rather than reload into stale data.
        const refusing = { ...memoryStore({ "plinky:scores": "[]" }), remove: () => {} };
        renderWithServices(<DangerZone />, { store: refusing });

        fireEvent.click(screen.getByRole("button", { name: m.settings_reset() }));
        fireEvent.click(screen.getByRole("button", { name: m.settings_reset_yes() }));
        expect(screen.getByRole("alert")).toBeTruthy();
    });
});
