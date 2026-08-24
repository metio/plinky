// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router";
import { BottomNav } from "../components/ui/navBar";
import { SiteFooter } from "../components/ui/siteFooter";
import { isLocale } from "../paraglide/runtime.js";
import { localizedHref } from "../components/ui/href";

// The parent of every localized page. The active locale comes from the URL
// prefix (the `url` strategy reads it directly), so this validates the segment
// and keeps <html lang> in sync on the client.
export default function LocaleLayout() {
    const { locale } = useParams();
    const { pathname } = useLocation();
    const valid = isLocale(locale);

    useEffect(() => {
        if (valid && locale) {
            document.documentElement.lang = locale;
        }
    }, [valid, locale]);

    // A first segment that is not a language can be two different mistakes, and which one
    // it is can be read off whether anything follows it.
    //
    // "/zz/play/abc" fills the language slot with something that is not a language — a
    // typo, a stale link, a bot probing paths — and the page after it is recoverable: drop
    // the bad segment, keep the rest, localise that.
    //
    // "/music" is not a mistyped language at all. It is a page name that arrived with no
    // language in front of it, from a hand-typed address or an old link, and dropping it
    // would answer a request for the library with the home page. So a lone segment is kept
    // and localised. The cost is that a bare "/zz" now lands on the not-found page instead
    // of the home page: nothing at runtime can tell "/music" from "/zz", and of the two
    // readings the one that serves a real address is worth more than the one that tidies
    // away a typo.
    //
    // localizedHref picks the language the way the bare "/" does — the one last chosen,
    // else the browser's, else English. During prerender there is no navigator to resolve
    // against, and an unknown locale is never prerendered, so the redirect is deferred to
    // the client exactly as the root redirect does.
    if (!valid) {
        if (typeof window === "undefined") {
            return null;
        }
        const rest = pathname.replace(/^\/[^/]+/, "");
        return <Navigate to={localizedHref(rest === "" ? pathname : rest)} replace />;
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
