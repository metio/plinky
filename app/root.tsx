// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLocation } from "react-router";

import type { Route } from "./+types/root";
import { LocalizedLink as Link } from "./components/ui/localizedLink";
import { GradeBadge } from "./components/features/gradeBadge";
import { HeaderNav } from "./components/ui/navBar";
import { StorageBanner } from "./components/features/storageBanner";
import { UpdateBanner } from "./components/features/updateBanner";
import { MilestoneBannerHost } from "./components/features/milestoneBanner";
import { MilestoneProvider } from "./contexts/milestone";
import { SoundHint } from "./components/features/soundHint";
import { isInAppBrowser, isIosLike } from "../core/platform";
import { HelpLink } from "./components/features/helpLink";
import { browserStore, storageHealth } from "./adapters/browserStore";
import { runActivity } from "./lib/activity";
import { describeError, issueUrl } from "./lib/errorReport";
import { createSwUpdateWatcher, type SwUpdateWatcher } from "./lib/swUpdate";
import { MidiProvider } from "./contexts/midi";
import { ServicesProvider } from "./contexts/services";
import { applyTheme } from "./lib/theme";
import { createThemeStore, themeBootstrapScript } from "./stores/themeStore";
import { ogLocale, SITE_URL } from "../core/site";
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

// The layout renders outside the services provider (it IS the provider's
// parent), so it reads the theme through its own store instance over the real
// adapter — the composition root wiring its own defaults. Reads only; the
// toggle writes through the injected store and applies the class itself.
const themeStore = createThemeStore(browserStore);

// Runs before first paint to set the dark class from the saved (or OS) theme.
// Applying the theme only in the layout's effect would let the prerendered,
// class-free HTML paint light first and flash for dark-mode users. It mutates
// the class outside React, which React's hydration leaves untouched.
const THEME_INIT_SCRIPT = themeBootstrapScript();

export const links: Route.LinksFunction = () => [
    { rel: "icon", href: "/icon-192.png", type: "image/png" },
    { rel: "manifest", href: "/manifest.webmanifest" },
    { rel: "apple-touch-icon", href: "/icon-180.png" },
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
        <header className="border-b border-gray-200 px-6 py-3 font-sans dark:border-gray-800">
            <div className="mx-auto flex max-w-3xl items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* The wordmark is text (it follows the theme for free); its i is the
                        dotless ı with a pink dot drawn above, echoing the app icon's
                        accent. Decorative only — the link carries the accessible name. */}
                    <Link to="/" aria-label="Plinky home" className="flex items-center gap-2">
                        <img src="/icon-192.png" alt="" className="h-8 w-8 rounded-md" />
                        <span
                            aria-hidden="true"
                            className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100"
                        >
                            Pl
                            <span className="relative">
                                ı
                                <span className="absolute left-1/2 top-[0.16em] h-[0.14em] w-[0.14em] -translate-x-1/2 rounded-full bg-fuchsia-400" />
                            </span>
                            nky
                        </span>
                    </Link>
                    <GradeBadge />
                </div>
                {/* On wide screens the destinations sit inline; on phones they move to
                    the fixed bottom tab bar (BottomNav), so the header stays slim. */}
                <HeaderNav className="hidden items-center gap-1 md:flex" />
                <div className="flex items-center gap-4">
                    <HelpLink />
                    <Link
                        to="/settings"
                        aria-label={m.nav_settings()}
                        className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            className="h-5 w-5"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a7.7 7.7 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.6 6.6 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.5 6.5 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.9 6.9 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                            />
                        </svg>
                    </Link>
                </div>
            </div>
        </header>
    );
}

// The service-worker update state machine lives in lib/swUpdate; this hook is the
// composition root's wiring — it owns navigator.serviceWorker, window.location and
// the timers, and hands components downstream only the boolean and the "apply"
// callback.
function useServiceWorkerUpdate() {
    const [watcher, setWatcher] = useState<SwUpdateWatcher | null>(null);

    useEffect(() => {
        // In dev the SW would cache the dev server's assets and serve them stale.
        if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
            return;
        }
        const created = createSwUpdateWatcher(navigator.serviceWorker, {
            reload: () => window.location.reload(),
            setTimeout: (run, ms) => window.setTimeout(run, ms),
            clearTimeout: (id) => window.clearTimeout(id),
            // A reload must not wipe out a practice run: park it while a run is
            // active and release it the moment the app goes idle.
            holdReload: () => runActivity.active(),
        });
        setWatcher(created);
        const unsubscribe = runActivity.subscribe(() => {
            if (!runActivity.active()) {
                created.flushReload();
            }
        });
        return () => {
            unsubscribe();
            created.dispose();
        };
    }, []);

    const subscribe = useCallback(
        (onChange: () => void) => (watcher ? watcher.subscribe(onChange) : () => {}),
        [watcher],
    );
    const updateReady = useSyncExternalStore(
        subscribe,
        () => watcher?.updateReady() ?? false,
        () => false,
    );
    const updateBroken = useSyncExternalStore(
        subscribe,
        () => watcher?.registrationFailed() ?? false,
        () => false,
    );
    const applyUpdate = useCallback(() => watcher?.applyUpdate(), [watcher]);

    return { updateReady, updateBroken, applyUpdate };
}

export function Layout({ children }: { children: React.ReactNode }) {
    const { updateReady, updateBroken, applyUpdate } = useServiceWorkerUpdate();
    // Apply the saved theme (following the OS when "system") here in the layout,
    // so even the error page is themed — App's render is skipped on an error.
    useEffect(() => {
        document.documentElement.lang = getLocale();
        applyTheme(themeStore.load());
        if (typeof matchMedia !== "function") {
            return;
        }
        // Stay subscribed regardless of the current theme: the user can switch to
        // "system" after mount, and re-reading the saved theme makes the OS change
        // a no-op for explicit light/dark and a live update only for "system".
        const media = matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => applyTheme(themeStore.load());
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
    const hasNavigator = typeof navigator !== "undefined";
    const iosLike = hasNavigator && isIosLike(navigator.userAgent, navigator.maxTouchPoints ?? 0);
    const inAppBrowser = hasNavigator && isInAppBrowser(navigator.userAgent);

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
                {/* Services wrap the header too — GradeBadge reads the injected prefs
                    store, and a provider that only wrapped the routed tree would leave
                    the header on the default services, silently ignoring any override. */}
                <ServicesProvider>
                    <Header />
                    {/* The layout is the composition root: it hands the banner the
                        adapter's health signal so the banner itself stays oblivious
                        to where the signal comes from. */}
                    <StorageBanner health={storageHealth} />
                    {/* A newer build parks in "waiting"; this offers it as a prompt
                        rather than letting it swap in mid-interaction. */}
                    <UpdateBanner
                        updateReady={updateReady}
                        updateBroken={updateBroken}
                        onReload={applyUpdate}
                    />
                    {/* iOS is decided at this composition root and passed down, so
                        the hint component reads no browser global of its own. */}
                    <SoundHint iosLike={iosLike} inAppBrowser={inAppBrowser} />
                    {/* An earned moment from a run anywhere in the routed tree publishes
                        to the channel; the shell banner is its single subscriber, so the
                        celebration is the same wherever the run happened. */}
                    <MilestoneProvider>
                        <MilestoneBannerHost />
                        {children}
                    </MilestoneProvider>
                </ServicesProvider>
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    // The service worker is registered by the layout's update watcher, which also
    // offers a new build as a prompt rather than swapping it in mid-interaction.
    return (
        <MidiProvider>
            <Outlet />
        </MidiProvider>
    );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    const report = describeError(error);
    const { notFound, technical } = report;

    const where = typeof window !== "undefined" ? window.location.href : "";
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const reportUrl = issueUrl(REPO_ISSUES, report, where, userAgent);

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
                    href={reportUrl}
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
