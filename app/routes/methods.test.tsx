// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
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
        expect(screen.getAllByRole("link", { name: m.methods_try() })).toHaveLength(METHODS.length);
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
