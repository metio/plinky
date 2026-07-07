// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { m } from "../../paraglide/messages.js";
import { LoopRangeBar } from "./loopRangeBar";

afterEach(cleanup);

// A stateful host, so the clamp behaviour is observed through real re-renders.
function Host({ measureCount = 8, onWholeSong = () => {} }) {
    const [from, setFrom] = useState(1);
    const [to, setTo] = useState(measureCount);
    return (
        <LoopRangeBar
            measureCount={measureCount}
            from={from}
            to={to}
            setFrom={setFrom}
            setTo={setTo}
            onWholeSong={onWholeSong}
        />
    );
}

describe("LoopRangeBar", () => {
    it("hints at narrowing while the whole song loops, and offers the reset once narrowed", () => {
        const onWholeSong = vi.fn();
        render(<Host onWholeSong={onWholeSong} />);
        expect(screen.getByText(m.loop_hint_narrow())).toBeTruthy();

        fireEvent.change(screen.getByLabelText(m.loop_from()), { target: { value: "3" } });
        fireEvent.click(screen.getByText(m.loop_whole_song()));
        expect(onWholeSong).toHaveBeenCalledOnce();
    });

    it("clamps the range to the piece and never lets it invert", () => {
        render(<Host />);
        const from = screen.getByLabelText<HTMLInputElement>(m.loop_from());
        const to = screen.getByLabelText<HTMLInputElement>(m.loop_to());

        fireEvent.change(to, { target: { value: "4" } });
        // A start past the end drags the end along.
        fireEvent.change(from, { target: { value: "6" } });
        expect(from.value).toBe("6");
        expect(to.value).toBe("6");
        // An end before the start clamps up to it.
        fireEvent.change(to, { target: { value: "2" } });
        expect(to.value).toBe("6");
        // Out-of-piece values clamp to the bar count.
        fireEvent.change(to, { target: { value: "99" } });
        expect(to.value).toBe("8");
    });
});
