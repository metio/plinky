// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BeatIndicator } from "./beatIndicator";

afterEach(cleanup);

describe("BeatIndicator", () => {
    it("renders one dot per beat in the bar", () => {
        const { container } = render(<BeatIndicator beat={1} beatsPerBar={4} />);
        expect(container.querySelectorAll("span")).toHaveLength(4);
    });

    it("highlights the active beat and dims the rest", () => {
        const { container } = render(<BeatIndicator beat={2} beatsPerBar={3} />);
        const dots = [...container.querySelectorAll("span")];
        // beat === index + 1, so the second dot is active.
        expect(dots[1].className).toContain("bg-indigo-600");
        expect(dots[0].className).toContain("bg-gray-300");
    });
});
