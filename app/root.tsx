// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLocation } from "react-router";

import type { Route } from "./+types/root";
import { LocalizedLink as Link } from "./components/ui/localizedLink";
import { FaultRecorder } from "./components/features/faultRecorder";
import { StorageBanner } from "./components/features/storageBanner";
import { UpdateBanner } from "./components/features/updateBanner";
import { MilestoneBannerHost } from "./components/features/milestoneBanner";
import { MilestoneProvider } from "./contexts/milestone";
import { SoundHint } from "./components/features/soundHint";
import { isInAppBrowser, isIosLike } from "../core/platform";
import { browserStore, storageHealth } from "./adapters/browserStore";
import { runActivity } from "./lib/activity";
import { describeError, issueUrl, REPO_ISSUES } from "./lib/errorReport";
import { createSwUpdateWatcher, type SwUpdateWatcher } from "./lib/swUpdate";
import { MidiProvider } from "./contexts/midi";
import { ServicesProvider } from "./contexts/services";
import { applyTheme } from "./lib/theme";
import { returningBootstrapScript } from "./stores/historyStore";
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
// The display face, for the wordmark and page titles only (see --font-display).
// Fredoka carries the wordmark's own letterforms and covers Latin only. Comfortaa sits
// behind it in the stack for Greek and Cyrillic, which Fredoka has no glyphs for at all —
// and because every subset is its own @font-face with a unicode-range, a Latin reader never
// downloads a byte of it. Each locale fetches the one face its script actually needs.
import "@fontsource-variable/fredoka/wght.css";
import "@fontsource-variable/comfortaa/wght.css";
import "@fontsource-variable/inter/wght-italic.css";
import "./app.css";
import { SiteHeader } from "./components/features/siteHeader";

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
// Stamps a device that has played before, so Today opens on the practice rather than
// on the introduction. Runs before paint for the same reason the theme does.
const RETURNING_INIT_SCRIPT = returningBootstrapScript();

export const links: Route.LinksFunction = () => [
    // The tab wears the mark itself. It is a raster lockup, so there is no theme-answering
    // SVG beside it any more and nothing to keep in step with one: the ICO and the PNG are
    // two encodings of the same render, for browsers that read one or the other.
    { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
    { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
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
    const updateBroken = useSyncExternalStore(
        subscribe,
        () => watcher?.registrationFailed() ?? false,
        () => false,
    );
    // A waiting build is taken at the next natural boundary rather than announced.
    //
    // Nobody has a reason to decline an update, so asking was a chore with one sensible
    // answer. It applies on a route change or on coming back to a backgrounded tab —
    // moments the reader already experiences as the app loading something — and never
    // while anything is in progress, which the activity signal decides.
    //
    // Once per page load: if a reload somehow lands back here still holding a waiting
    // build, a second attempt would loop the page rather than fix anything.
    const applied = useRef(false);
    const location = useLocation();
    // biome-ignore lint/correctness/useExhaustiveDependencies: the pathname is the trigger, not a read — a route change is the boundary
    useEffect(() => {
        if (!watcher || applied.current) {
            return;
        }
        applied.current = watcher.applyIfIdle();
    }, [watcher, location.pathname]);

    useEffect(() => {
        if (!watcher) {
            return;
        }
        const onVisible = () => {
            if (document.visibilityState === "visible" && !applied.current) {
                applied.current = watcher.applyIfIdle();
            }
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [watcher]);

    return { updateBroken };
}

export function Layout({ children }: { children: React.ReactNode }) {
    const { updateBroken } = useServiceWorkerUpdate();
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
                {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a static, self-contained returning-visitor bootstrap that must run before paint */}
                <script dangerouslySetInnerHTML={{ __html: RETURNING_INIT_SCRIPT }} />
                {/* The browser paints its own chrome with this — the address bar on Android,
                    the title bar of an installed window. It names the header's colour, so
                    the chrome above continues the page rather than drawing a seam across
                    the top of the app. */}
                <meta name="theme-color" content="#ffffff" />
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
                {/* The card is the same site-wide brand image on every page, so its
                    alt is the brand line — already translated for every locale. */}
                <meta property="og:image:alt" content={m.meta_home_title()} />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:image" content={`${SITE_URL}/og.png`} />
                <meta name="twitter:image:alt" content={m.meta_home_title()} />
                <Meta />
                <Links />
                {/* Cloudflare Web Analytics: page views and Core Web Vitals, measured
                    without cookies and without anything that identifies a visitor, so
                    there is no consent to ask for and no banner to dismiss. The token
                    identifies the site, not the reader, and is public by design — it
                    travels in the page source of every site that uses the beacon. What
                    it cannot do is custom events; a question about a specific feature
                    needs its own endpoint, not a flag flipped here. */}
                <script
                    type="module"
                    src="https://static.cloudflareinsights.com/beacon.min.js"
                    data-cf-beacon='{"token": "9b87198c106648e9ab7e874be5e02527"}'
                />
            </head>
            <body>
                {/* Services wrap the header too — GradeBadge reads the injected prefs
                    store, and a provider that only wrapped the routed tree would leave
                    the header on the default services, silently ignoring any override. */}
                <ServicesProvider>
                    {/* Nothing outside a React render reaches a boundary, so the faults
                        that leave no fallback and no report link are written down here
                        instead — for the reader to send from Settings when they do. */}
                    <FaultRecorder />
                    <SiteHeader />
                    {/* The layout is the composition root: it hands the banner the
                        adapter's health signal so the banner itself stays oblivious
                        to where the signal comes from. */}
                    <StorageBanner health={storageHealth} />
                    {/* A newer build takes over by itself at the next boundary, so there
                        is nothing to announce. What is worth saying is the opposite: this
                        device can no longer receive updates at all. */}
                    <UpdateBanner updateBroken={updateBroken} />
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
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
                {notFound ? "We couldn't find that" : "Something went wrong"}
            </h1>
            <p className="text-muted">
                {notFound
                    ? "That page or exercise doesn't exist — it may have been removed, or the link is slightly off."
                    : "This is a bug on our side, not anything you did. Your scores are safe on this device — try heading back or reloading."}
            </p>

            <div className="flex flex-wrap gap-2">
                <Link
                    to="/"
                    className="rounded-md bg-accent-solid px-4 py-2 text-sm font-medium text-white"
                >
                    Back to exercises
                </Link>
                {!notFound && (
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-body"
                    >
                        Reload the page
                    </button>
                )}
                <a
                    href={reportUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-body"
                >
                    Report it on GitHub
                </a>
            </div>

            <details className="text-sm text-muted">
                <summary className="cursor-pointer">Technical details</summary>
                <pre className="mt-2 overflow-x-auto rounded-md bg-sunken p-3 text-xs">
                    <code>{technical}</code>
                </pre>
            </details>
        </main>
    );
}
