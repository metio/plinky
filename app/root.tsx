// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import {
    isRouteErrorResponse,
    Link,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from "react-router";

import { useEffect } from "react";
import type { Route } from "./+types/root";
import { ThemeToggle } from "./components/themeToggle";
import { MidiProvider } from "./contexts/midi";
import { applyTheme, loadTheme } from "./lib/theme";
import "./app.css";

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

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="theme-color" content="#4f46e5" />
                <Meta />
                <Links />
            </head>
            <body>
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

    // Apply the saved theme, and follow the OS when set to "system".
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
        <MidiProvider>
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
            <Outlet />
        </MidiProvider>
    );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    let message = "Oops!";
    let details = "An unexpected error occurred.";
    let stack: string | undefined;

    if (isRouteErrorResponse(error)) {
        message = error.status === 404 ? "404" : "Error";
        details =
            error.status === 404
                ? "The requested page could not be found."
                : error.statusText || details;
    } else if (import.meta.env.DEV && error && error instanceof Error) {
        details = error.message;
        stack = error.stack;
    }

    return (
        <main className="pt-16 p-4 container mx-auto">
            <h1>{message}</h1>
            <p>{details}</p>
            {stack && (
                <pre className="w-full p-4 overflow-x-auto">
                    <code>{stack}</code>
                </pre>
            )}
        </main>
    );
}
