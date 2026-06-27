// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect } from "react";
import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import { LocalizedLink as Link } from "./components/localizedLink";
import { GradeBadge } from "./components/gradeBadge";
import { StreakBadge } from "./components/streakBadge";
import { ThemeToggle } from "./components/themeToggle";
import { MidiProvider } from "./contexts/midi";
import { applyTheme, loadTheme, THEME_STORAGE_KEY } from "./lib/theme";
import { ogLocale, SITE_URL } from "./lib/site";
import { m } from "./paraglide/messages.js";
import {
    baseLocale,
    deLocalizeHref,
    getLocale,
    locales,
    localizeUrl,
} from "./paraglide/runtime.js";
// Self-hosted Inter (variable). The wght CSS covers every weight across the
// Latin/Cyrillic/Greek subsets via unicode-range, so each locale only downloads
// the subset it needs; the Latin file is preloaded below. Bundling it removes
// the render-blocking Google Fonts request.
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/inter/wght-italic.css";
import "./app.css";

const REPO_ISSUES = "https://github.com/metio/plinky/issues/new";

// Locales whose UI text is not drawn from Inter's Latin subset: Cyrillic and
// Greek pages render from a different Inter subset, and CJK pages fall back to
// system fonts. Preloading the Latin file on those pages competes with the
// subset (or system font) that actually paints the page's primary text, so the
// preload is emitted only for the Latin-script locales that benefit from it.
const NON_LATIN_LOCALES = new Set(["el", "ru", "uk", "sr", "ja", "ko", "zh"]);

// Runs before first paint to set the dark class from the saved (or OS) theme.
// Applying the theme only in the layout's effect would let the prerendered,
// class-free HTML paint light first and flash for dark-mode users. It mutates
// the class outside React, which React's hydration leaves untouched.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY,
)});if(t!=="light"&&t!=="dark"&&t!=="system"){t="system";}if(t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export const links: Route.LinksFunction = () => [
    { rel: "icon", href: "/logo.svg", type: "image/svg+xml" },
    { rel: "manifest", href: "/manifest.webmanifest" },
    { rel: "apple-touch-icon", href: "/logo.svg" },
    // Preload the Latin variable font so text paints in Inter without a swap;
    // the href is the same hashed asset the bundled @font-face resolves to. Only
    // for locales whose text actually comes from this subset (see above).
    ...(NON_LATIN_LOCALES.has(getLocale())
        ? []
        : [
              {
                  rel: "preload",
                  as: "font",
                  type: "font/woff2",
                  href: interLatin,
                  crossOrigin: "anonymous",
              } as const,
          ]),
];

// The header lives in the layout so it — and the theme — are present on every
// screen, including the error page, giving a way back from anywhere.
function Header() {
    return (
        <nav className="border-b border-gray-200 px-6 py-3 font-sans dark:border-gray-800">
            <div className="mx-auto flex max-w-3xl items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link to="/" aria-label="Plinky home">
                        <img src="/logo-horizontal.svg" alt="Plinky" className="h-8" />
                    </Link>
                    <StreakBadge />
                    <GradeBadge />
                </div>
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <Link
                        to="/compose"
                        className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        {m.nav_compose()}
                    </Link>
                    <Link
                        to="/library"
                        className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        {m.nav_library()}
                    </Link>
                    <Link
                        to="/settings"
                        className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        {m.nav_settings()}
                    </Link>
                </div>
            </div>
        </nav>
    );
}

export function Layout({ children }: { children: React.ReactNode }) {
    // Apply the saved theme (following the OS when "system") here in the layout,
    // so even the error page is themed — App's render is skipped on an error.
    useEffect(() => {
        document.documentElement.lang = getLocale();
        applyTheme(loadTheme());
        if (typeof matchMedia !== "function") {
            return;
        }
        // Stay subscribed regardless of the current theme: the user can switch to
        // "system" after mount, and re-reading the saved theme makes the OS change
        // a no-op for explicit light/dark and a live update only for "system".
        const media = matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => applyTheme(loadTheme());
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);

    // The locale-prefixed URL of this exact page, plus its canonical (unprefixed)
    // form, for the self-referential canonical/og:url and the hreflang cluster
    // that ties all language versions of the page together for search engines.
    const { pathname } = useLocation();
    const locale = getLocale();
    const pageUrl = `${SITE_URL}${pathname}`;
    const canonical = new URL(`${SITE_URL}${deLocalizeHref(pathname)}`);

    return (
        <html lang={locale}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a static, self-contained theme bootstrap that must run before paint */}
                <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
                <meta name="theme-color" content="#4f46e5" />
                <link rel="canonical" href={pageUrl} />
                {/* One alternate per language so search engines serve the right
                    locale and share ranking signals across the cluster. */}
                {locales.map((locale) => (
                    <link
                        key={locale}
                        rel="alternate"
                        hrefLang={locale}
                        href={localizeUrl(canonical, { locale }).href}
                    />
                ))}
                <link
                    rel="alternate"
                    hrefLang="x-default"
                    href={localizeUrl(canonical, { locale: baseLocale }).href}
                />
                {/* Site-wide social-card fields; each route's meta adds the
                    per-page og:title / og:description and twitter equivalents. */}
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="Plinky" />
                <meta property="og:url" content={pageUrl} />
                <meta property="og:locale" content={ogLocale(locale)} />
                {locales
                    .filter((alternate) => alternate !== locale)
                    .map((alternate) => (
                        <meta
                            key={alternate}
                            property="og:locale:alternate"
                            content={ogLocale(alternate)}
                        />
                    ))}
                <meta property="og:image" content={`${SITE_URL}/og.png`} />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:image" content={`${SITE_URL}/og.png`} />
                <Meta />
                <Links />
            </head>
            <body>
                <Header />
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    // Register the offline service worker in production builds only; in dev it
    // would cache the dev server's assets and serve them stale.
    useEffect(() => {
        if (import.meta.env.PROD && "serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js").catch(() => {});
        }
    }, []);

    return (
        <MidiProvider>
            <Outlet />
        </MidiProvider>
    );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    const notFound = isRouteErrorResponse(error) && error.status === 404;

    let technical: string;
    if (isRouteErrorResponse(error)) {
        technical = `${error.status} ${error.statusText}`;
    } else if (error instanceof Error) {
        technical = `${error.message}\n\n${error.stack ?? ""}`.trim();
    } else {
        technical = String(error);
    }

    const where = typeof window !== "undefined" ? window.location.href : "";
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const body = [
        "**What were you doing when this happened?**",
        "",
        "_(please describe)_",
        "",
        `**Page:** ${where}`,
        "",
        "**Details**",
        "",
        "```",
        technical,
        "```",
        "",
        `**Browser:** ${userAgent}`,
    ].join("\n");
    const issueUrl = `${REPO_ISSUES}?title=${encodeURIComponent(
        notFound ? "Page not found" : `Error: ${technical.split("\n")[0]}`,
    )}&body=${encodeURIComponent(body)}`;

    return (
        <main className="mx-auto max-w-3xl space-y-4 p-6 font-sans">
            <h1 className="text-2xl font-semibold">
                {notFound ? "We couldn't find that" : "Something went wrong"}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
                {notFound
                    ? "That page or exercise doesn't exist — it may have been removed, or the link is slightly off."
                    : "This is a bug on our side, not anything you did. Your scores are safe on this device — try heading back or reloading."}
            </p>

            <div className="flex flex-wrap gap-2">
                <Link
                    to="/"
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                >
                    Back to exercises
                </Link>
                {!notFound && (
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                    >
                        Reload the page
                    </button>
                )}
                <a
                    href={issueUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                >
                    Report it on GitHub
                </a>
            </div>

            <details className="text-sm text-gray-500 dark:text-gray-400">
                <summary className="cursor-pointer">Technical details</summary>
                <pre className="mt-2 overflow-x-auto rounded-md bg-gray-50 p-3 text-xs dark:bg-gray-900">
                    <code>{technical}</code>
                </pre>
            </details>
        </main>
    );
}
