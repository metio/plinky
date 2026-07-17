// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router";
import { BottomNav } from "../components/ui/navBar";
import { SiteFooter } from "../components/ui/siteFooter";
import { useSongSource } from "../contexts/services";
import { isLocale, localizeHref } from "../paraglide/runtime.js";

// The parent of every localized page. The active locale comes from the URL
// prefix (the `url` strategy reads it directly), so this validates the segment
// and keeps <html lang> in sync on the client.
export default function LocaleLayout() {
    const songs = useSongSource();
    const { locale } = useParams();
    const { pathname } = useLocation();
    const valid = isLocale(locale);

    useEffect(() => {
        if (valid && locale) {
            document.documentElement.lang = locale;
        }
    }, [valid, locale]);

    // On first run, seed a few songs per grade into the library so it's useful out
    // of the box; guarded so it happens once.
    useEffect(() => {
        if (valid) {
            songs.ensureSeeded();
        }
    }, [valid, songs.ensureSeeded]);

    // An unknown locale prefix — a typo, a stale link, a bot probing paths — can't
    // select a language, so redirect to the same page under the resolved locale rather
    // than dead-ending: the visitor keeps the page they asked for. localizeHref picks the
    // target the way the bare "/" does (the language last chosen, else the browser's,
    // else English); the bad first segment is dropped and the rest re-localized. During
    // prerender there is no navigator to resolve against — and an unknown locale is never
    // prerendered — so defer the redirect to the client, exactly as the root redirect does.
    if (!valid) {
        if (typeof window === "undefined") {
            return null;
        }
        const rest = pathname.replace(/^\/[^/]+/, "") || "/";
        return <Navigate to={localizeHref(rest)} replace />;
    }

    return (
        <>
            {/* Room for the fixed mobile tab bar so it never covers the last of a page. */}
            <div className="pb-20 md:pb-0">
                {/* The page area holds at least a viewport, so the footer paints below
                    the fold and client-side content never shoves it down mid-view — a
                    footer that enters the first paint high on an empty page and then
                    jumps is a cumulative-layout-shift the perf gate rejects. */}
                <div className="min-h-svh">
                    <Outlet />
                </div>
                <SiteFooter />
            </div>
            <BottomNav />
        </>
    );
}
