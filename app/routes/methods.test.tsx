// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { METHODS } from "../../core/practiceMethods";
import { m } from "../paraglide/messages.js";
import MethodsRoute from "./methods";

afterEach(cleanup);

describe("MethodsRoute", () => {
    it("lists every method with a way into the app", () => {
        render(
            <MemoryRouter>
                <MethodsRoute />
            </MemoryRouter>,
        );
        // Three methods are done with a control inside a run's set-up panel, so what
        // they can honestly offer is a piece to try them on; the other three lead
        // straight to the thing itself. Every method has a way in either way.
        const straight = METHODS.filter((method) => method.href !== "/library/").length;
        expect(screen.getAllByRole("link", { name: m.methods_try() })).toHaveLength(straight);
        expect(screen.getAllByRole("link", { name: m.today_browse() })).toHaveLength(
            METHODS.length - straight,
        );
    });

    it("names each method and says roughly how long it takes", () => {
        render(
            <MemoryRouter>
                <MethodsRoute />
            </MemoryRouter>,
        );
        expect(screen.getByRole("heading", { name: m.method_chunking_name() })).toBeTruthy();
        expect(screen.getByText(m.method_chunking_how())).toBeTruthy();
        expect(screen.getByText(m.method_chunking_why())).toBeTruthy();
        for (const method of METHODS) {
            expect(
                screen.getAllByText(m.methods_dose({ count: method.minutes })).length,
            ).toBeGreaterThan(0);
        }
    });
});
