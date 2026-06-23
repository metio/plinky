// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Hand } from "../lib/hands";
import { HandSelector, useHandSelection } from "./handSelector";

const twoHands: Hand[] = [
    { staff: 0, label: "Right", steps: [] },
    { staff: 1, label: "Left", steps: [] },
];

afterEach(cleanup);

describe("useHandSelection", () => {
    it("defaults to both hands and filters to one by staff", () => {
        const { result } = renderHook(() => useHandSelection(twoHands));
        expect(result.current.hands).toHaveLength(2);
        act(() => result.current.setChoice(1));
        expect(result.current.hands).toEqual([twoHands[1]]);
    });
});

describe("HandSelector", () => {
    it("renders nothing for a single hand", () => {
        const { container } = render(
            <HandSelector hands={[twoHands[0]]} value="both" onChange={() => {}} />,
        );
        expect(container.firstChild).toBeNull();
    });

    it("offers both hands and each hand on a grand staff", () => {
        render(<HandSelector hands={twoHands} value="both" onChange={() => {}} />);
        expect(screen.getByText("Both hands")).toBeDefined();
        expect(screen.getByText("Right hand")).toBeDefined();
        expect(screen.getByText("Left hand")).toBeDefined();
    });
});
