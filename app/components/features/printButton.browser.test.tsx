// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PrintButton } from "./printButton";

// PrintButton pulls in OSMD (which needs a real browser), so it runs in the browser
// project. The actual print flow opens a window; here we just confirm it mounts with
// an accessible control and no provider wired.
afterEach(cleanup);

describe("PrintButton", () => {
    it("renders an accessible print control", () => {
        render(<PrintButton xml="<score/>" title="T" />);
        expect(screen.getByRole("button", { name: /print/i })).toBeTruthy();
    });
});
