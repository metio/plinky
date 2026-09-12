// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub, MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { Route } from "./+types/root";
import { NotFoundError } from "./lib/errorReport";
import { m } from "./paraglide/messages.js";
import { locales, overwriteGetLocale } from "./paraglide/runtime.js";
import { ErrorBoundary, Layout, links } from "./root";
import { THEME_STORAGE_KEY } from "./stores/themeStore";

const fontPreload = (): string | null => {
    const found = links().find(
        (link) => "as" in link && link.as === "font" && link.rel === "preload",
    );
    return found && "href" in found ? String(found.href) : null;
};

afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    overwriteGetLocale(() => "en");
});

describe("root links", () => {
    it("preloads the Latin font for a Latin-script locale", () => {
        for (const locale of ["en", "de"] as const) {
            overwriteGetLocale(() => locale);
            expect(fontPreload()).toMatch(/latin/);
        }
    });

    it("preloads the subset the page's own text is drawn from", () => {
        // Naming the wrong subset is worse than naming none: the page spends its
        // connection on bytes it never draws with, and the subset that does paint it is
        // discovered from the stylesheet afterwards — so the text paints in a fallback and
        // reflows when Inter lands. On a page of paragraphs that moves a whole viewport
        // of them, which is how it first showed up: as layout shift on the Greek /news.
        overwriteGetLocale(() => "el");
        expect(fontPreload()).toMatch(/greek/);
        for (const locale of ["ru", "uk", "sr"] as const) {
            overwriteGetLocale(() => locale);
            expect(fontPreload()).toMatch(/cyrillic/);
        }
    });

    it("preloads nothing where the reader's own system fonts draw the page", () => {
        // Asking for Inter on a CJK page is a download nothing renders from.
        for (const locale of ["ja", "ko", "zh"] as const) {
            overwriteGetLocale(() => locale);
            expect(fontPreload()).toBeNull();
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
        expect(screen.getByRole("link", { name: m.header_home_label() })).toBeTruthy();
        expect(screen.getByTestId("page")).toBeTruthy();
    });

    // The mark is decorative, so this label is the whole accessible name of the first
    // link on every page — heard first, and in the page's language.
    it("names the home link in the page's language", () => {
        for (const locale of ["fr", "ja"] as const) {
            overwriteGetLocale(() => locale);
            renderLayout();
            const home = screen.getByRole("link", {
                name: m.header_home_label({}, { locale }),
            });
            expect(home.getAttribute("href")).toBe(`/${locale}/`);
            expect(home.getAttribute("aria-label")).not.toBe(
                m.header_home_label({}, { locale: "en" }),
            );
            cleanup();
        }
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

    it("writes the site's card only where the page brought none of its own", () => {
        const images = () => [
            ...document.head.querySelectorAll('meta[property="og:image"]'),
            ...document.body.querySelectorAll('meta[property="og:image"]'),
        ];
        renderLayout();
        expect(images().map((tag) => tag.getAttribute("content"))).toEqual([
            "https://plinky.fun/og.png",
        ]);
        cleanup();
        document.head.replaceChildren();
        const Stub = createRoutesStub([
            {
                path: "/",
                handle: { cardFor: () => true },
                meta: () => [{ property: "og:image", content: "https://plinky.fun/og/x.png" }],
                Component: () => (
                    <Layout>
                        <div data-testid="page" />
                    </Layout>
                ),
            },
        ]);
        render(<Stub />);
        expect(images().map((tag) => tag.getAttribute("content"))).toEqual([
            "https://plinky.fun/og/x.png",
        ]);
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
        expect(screen.getByRole("heading").textContent).toBe(m.error_missing_title());
        expect(screen.getByText(m.error_missing_body())).toBeTruthy();
        expect(screen.queryByRole("button", { name: m.error_reload() })).toBeNull();
        expect(screen.getByRole("link", { name: m.error_home() })).toBeTruthy();
        const report = screen.getByRole("link", { name: m.action_report_problem() });
        expect(report.getAttribute("href")).toContain(encodeURIComponent("Page not found"));
    });

    it("shows the crash variant for a thrown Error, with reload and technical detail", () => {
        renderBoundary(new Error("boom"));
        expect(screen.getByRole("heading").textContent).toBe(m.error_crash_title());
        expect(screen.getByText(m.error_crash_body())).toBeTruthy();
        expect(screen.getByRole("button", { name: m.error_reload() })).toBeTruthy();
        expect(screen.getByText(m.error_details())).toBeTruthy();
        expect(screen.getByText(/boom/)).toBeTruthy();
        const report = screen.getByRole("link", { name: m.action_report_problem() });
        expect(report.getAttribute("href")).toContain(encodeURIComponent("Error: boom"));
    });

    // The page every in-language miss reaches: the catch-all raises NotFoundError for an
    // address that names a language and matches nothing, and the header above it is
    // already in that language.
    it("speaks the page's language on a German not-found page", () => {
        overwriteGetLocale(() => "de");
        renderBoundary(new NotFoundError("/de/lernen/"));
        const heading = screen.getByRole("heading").textContent;
        expect(heading).toBe(m.error_missing_title({}, { locale: "de" }));
        expect(heading).not.toBe(m.error_missing_title({}, { locale: "en" }));
        expect(screen.getByRole("link", { name: m.error_home({}, { locale: "de" }) })).toBeTruthy();
        expect(
            screen.getByRole("link", { name: m.action_report_problem({}, { locale: "de" }) }),
        ).toBeTruthy();
        // The issue a maintainer reads stays English whatever the page spoke.
        const report = screen.getByRole("link", { name: m.action_report_problem() });
        expect(report.getAttribute("href")).toContain(encodeURIComponent("Page not found"));
    });

    it("speaks the page's language when a route throws", () => {
        overwriteGetLocale(() => "fr");
        renderBoundary(new Error("boom"));
        expect(screen.getByRole("heading").textContent).toBe(
            m.error_crash_title({}, { locale: "fr" }),
        );
        expect(
            screen.getByRole("button", { name: m.error_reload({}, { locale: "fr" }) }),
        ).toBeTruthy();
        expect(screen.getByText(m.error_details({}, { locale: "fr" }))).toBeTruthy();
    });

    it("sends the way home to the home page in the page's language", () => {
        overwriteGetLocale(() => "de");
        renderBoundary(new NotFoundError("/de/lernen/"));
        const home = screen.getByRole("link", { name: m.error_home() });
        expect(home.getAttribute("href")).toBe("/de/");
    });

    it("stringifies a thrown non-Error value", () => {
        renderBoundary("plain failure");
        expect(screen.getByText(/plain failure/)).toBeTruthy();
    });
});
