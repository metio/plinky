// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { isLocale } from "../paraglide/runtime.js";
import { renderWithServices } from "../testing/renderWithServices";
import LocaleLayout from "./localeLayout";

afterEach(cleanup);

// Shows where the router settled, so a redirect's destination is observable.
function Destination() {
    const { pathname } = useLocation();
    return <div data-testid="dest">{pathname}</div>;
}

function routerAt(initial: string) {
    return (
        <MemoryRouter initialEntries={[initial]}>
            <Routes>
                <Route path=":locale" element={<LocaleLayout />}>
                    <Route index element={<Destination />} />
                    <Route path="play/:scoreId" element={<Destination />} />
                </Route>
            </Routes>
        </MemoryRouter>
    );
}

describe("LocaleLayout", () => {
    it("redirects an unknown locale to the same page under a valid locale", async () => {
        renderWithServices(routerAt("/zz/play/abc"));
        const dest = (await screen.findByTestId("dest")).textContent ?? "";
        // The page is preserved (…/play/abc) but now under a real locale, not the "zz" typo.
        expect(dest).toMatch(/\/play\/abc$/);
        expect(dest.startsWith("/zz/")).toBe(false);
        expect(isLocale(dest.split("/")[1])).toBe(true);
    });

    it("redirects a bare unknown-locale root to the localized home", async () => {
        renderWithServices(routerAt("/zz"));
        const dest = (await screen.findByTestId("dest")).textContent ?? "";
        expect(dest.startsWith("/zz")).toBe(false);
        expect(isLocale(dest.split("/")[1])).toBe(true);
    });

    it("leaves a known locale untouched", async () => {
        renderWithServices(routerAt("/en/play/abc"));
        const dest = (await screen.findByTestId("dest")).textContent ?? "";
        expect(dest).toBe("/en/play/abc");
    });
});
