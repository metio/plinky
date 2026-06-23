// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TempoGraph } from "./tempoGraph";

afterEach(cleanup);

const points = [
    { index: 1, bpm: 100 },
    { index: 2, bpm: 80 },
    { index: 3, bpm: 120 },
];

describe("TempoGraph", () => {
    it("renders nothing without points", () => {
        const { container } = render(<TempoGraph points={[]} median={0} hotspots={[]} />);
        expect(container.querySelector("svg")).toBeNull();
    });

    it("draws a dot per sample and a connecting curve", () => {
        const { container } = render(<TempoGraph points={points} median={100} hotspots={[]} />);
        expect(container.querySelectorAll("circle")).toHaveLength(3);
        expect(container.querySelector("path")).not.toBeNull();
    });

    it("shades a band for each hotspot", () => {
        const { container } = render(
            <TempoGraph points={points} median={100} hotspots={[{ startIndex: 2, endIndex: 3 }]} />,
        );
        expect(container.querySelectorAll("rect")).toHaveLength(1);
    });
});
