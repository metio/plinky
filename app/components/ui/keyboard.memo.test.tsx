// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as noteNaming from "../../../core/noteNaming";
import { Keyboard } from "./keyboard";

vi.mock("../../../core/noteNaming", async (original) => {
    const real = await original<typeof import("../../../core/noteNaming")>();
    return { ...real, spokenKeyIn: vi.fn(real.spokenKeyIn) };
});

afterEach(cleanup);

// A hold fill redraws the keyboard on every frame, so the spoken names must be worked out
// once per range and naming, even when the caller leaves the naming to the keyboard.
describe("Keyboard's spoken names", () => {
    it("are not worked out again when the keyboard re-renders with the same props", () => {
        const spoken = vi.mocked(noteNaming.spokenKeyIn);
        const { rerender } = render(<Keyboard from={60} to={72} labels="all" />);
        const once = spoken.mock.calls.length;
        expect(once).toBeGreaterThanOrEqual(13);
        rerender(<Keyboard from={60} to={72} labels="all" />);
        rerender(<Keyboard from={60} to={72} labels="all" />);
        expect(spoken.mock.calls.length).toBe(once);
    });
});
