// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect } from "react";
import {
    isRouteErrorResponse,
    Link,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { ThemeToggle } from "./components/themeToggle";
import { MidiProvider } from "./contexts/midi";
import { seedStarterSongs } from "./lib/seed";
import { applyTheme, loadTheme } from "./lib/theme";
import { SITE_URL } from "./lib/site";
import "./app.css";

const REPO_ISSUES = "https://github.com/metio/plinky/issues/new";

export const links: Route.LinksFunction = () => [
    { rel: "icon", href: "/logo.svg", type: "image/svg+xml" },
    { rel: "manifest", href: "/manifest.webmanifest" },
    { rel: "apple-touch-icon", href: "/logo.svg" },
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
    },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
    },
];

// The header lives in the layout so it — and the theme — are present on every
// screen, including the error page, giving a way back from anywhere.
function Header() {
    return (
        <nav className="border-b border-gray-200 px-6 py-3 font-sans dark:border-gray-800">
            <div className="mx-auto flex max-w-3xl items-center justify-between">
                <Link to="/" aria-label="Plinky home">
                    <img src="/logo-horizontal.svg" alt="Plinky" className="h-8" />
                </Link>
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <Link
                        to="/progress"
                        className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        Progress
                    </Link>
                    <Link
                        to="/settings"
                        className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        Settings
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
        const theme = loadTheme();
        applyTheme(theme);
        if (theme === "system" && typeof matchMedia === "function") {
            const media = matchMedia("(prefers-color-scheme: dark)");
            const onChange = () => applyTheme("system");
            media.addEventListener("change", onChange);
            return () => media.removeEventListener("change", onChange);
        }
    }, []);

    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="theme-color" content="#4f46e5" />
                {/* Site-wide social-card fields; each route's meta adds the
                    per-page og:title / og:description and twitter equivalents. */}
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="Plinky" />
                <meta property="og:url" content={SITE_URL} />
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
        void seedStarterSongs();
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
                    : "This is a bug on our side, not anything you did. Your songs and scores are safe on this device — try heading back or reloading."}
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
