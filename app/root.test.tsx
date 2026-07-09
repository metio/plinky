// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub, MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { Route } from "./+types/root";
import { locales, overwriteGetLocale } from "./paraglide/runtime.js";
import { ErrorBoundary, Layout, links } from "./root";
import { THEME_STORAGE_KEY } from "./stores/themeStore";

const hasFontPreload = () =>
    links().some((link) => "as" in link && link.as === "font" && link.rel === "preload");

afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    overwriteGetLocale(() => "en");
});

describe("root links", () => {
    it("preloads the Latin font for a Latin-script locale", () => {
        overwriteGetLocale(() => "en");
        expect(hasFontPreload()).toBe(true);
        overwriteGetLocale(() => "de");
        expect(hasFontPreload()).toBe(true);
    });

    it("omits the Latin preload where the page's text comes from another subset", () => {
        // Cyrillic, Greek, and CJK pages paint their primary text from a different
        // Inter subset or a system font, so the Latin preload would only compete.
        for (const locale of ["ru", "uk", "sr", "el", "ja", "ko", "zh"] as const) {
            overwriteGetLocale(() => locale);
            expect(hasFontPreload()).toBe(false);
        }
    });
});

// The layout is the app shell around every screen: the themed header, the
// banners, and the document head's locale cluster. Rendering it inside a memory
// router covers the wiring the node suite otherwise never executes; the
// service-worker watcher stays inert because tests do not run a PROD build.
describe("Layout", () => {
    // <Meta>/<Links> read the framework context, so the layout renders through a
    // routes stub rather than a bare memory router.
    const renderLayout = () => {
        const Stub = createRoutesStub([
            {
                path: "/",
                Component: () => (
                    <Layout>
                        <div data-testid="page" />
                    </Layout>
                ),
            },
        ]);
        return render(<Stub />);
    };

    it("renders the header and the routed page", () => {
        renderLayout();
        expect(screen.getByLabelText("Plinky home")).toBeTruthy();
        expect(screen.getByTestId("page")).toBeTruthy();
    });

    it("stamps the document language from the active locale", () => {
        overwriteGetLocale(() => "de");
        renderLayout();
        expect(document.documentElement.lang).toBe("de");
    });

    it("applies a saved dark theme on mount", () => {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify("dark"));
        renderLayout();
        expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("emits one hreflang alternate per locale plus the x-default", () => {
        const { container } = renderLayout();
        // React hoists head-worthy <link> tags; count them wherever they land.
        const alternates = [
            ...container.querySelectorAll("link[rel=alternate]"),
            ...document.head.querySelectorAll("link[rel=alternate]"),
        ];
        const hreflangs = alternates.map((link) => link.getAttribute("hreflang"));
        for (const locale of locales) {
            expect(hreflangs).toContain(locale);
        }
        expect(hreflangs).toContain("x-default");
    });
});

describe("ErrorBoundary", () => {
    const renderBoundary = (error: unknown) =>
        render(
            <MemoryRouter>
                <ErrorBoundary
                    {...({ error, params: {} } as unknown as Route.ErrorBoundaryProps)}
                />
            </MemoryRouter>,
        );

    it("shows the gentle missing-page variant for a 404, with no reload button", () => {
        renderBoundary({ status: 404, statusText: "Not Found", internal: false, data: null });
        expect(screen.getByRole("heading").textContent).toBe("We couldn't find that");
        expect(screen.queryByRole("button", { name: "Reload the page" })).toBeNull();
        const report = screen.getByRole("link", { name: "Report it on GitHub" });
        expect(report.getAttribute("href")).toContain(encodeURIComponent("Page not found"));
    });

    it("shows the crash variant for a thrown Error, with reload and technical detail", () => {
        renderBoundary(new Error("boom"));
        expect(screen.getByRole("heading").textContent).toBe("Something went wrong");
        expect(screen.getByRole("button", { name: "Reload the page" })).toBeTruthy();
        expect(screen.getByText(/boom/)).toBeTruthy();
        const report = screen.getByRole("link", { name: "Report it on GitHub" });
        expect(report.getAttribute("href")).toContain(encodeURIComponent("Error: boom"));
    });

    it("stringifies a thrown non-Error value", () => {
        renderBoundary("plain failure");
        expect(screen.getByText(/plain failure/)).toBeTruthy();
    });
});
