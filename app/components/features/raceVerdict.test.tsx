// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { RaceVerdict } from "./raceVerdict";

afterEach(cleanup);

describe("RaceVerdict", () => {
    it("announces a win with the margin in seconds", () => {
        render(<RaceVerdict verdict={{ outcome: "won", marginMs: 2340 }} />);
        expect(screen.getByText(m.ghost_verdict_won({ margin: "2.3s" }))).toBeTruthy();
    });

    it("announces a loss with the margin", () => {
        render(<RaceVerdict verdict={{ outcome: "lost", marginMs: 1100 }} />);
        expect(screen.getByText(m.ghost_verdict_lost({ margin: "1.1s" }))).toBeTruthy();
    });

    it("calls a dead heat without a margin", () => {
        render(<RaceVerdict verdict={{ outcome: "tie", marginMs: 40 }} />);
        expect(screen.getByText(m.ghost_verdict_tie())).toBeTruthy();
    });
});
