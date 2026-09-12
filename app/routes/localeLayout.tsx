// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router";
import { BottomNav } from "../components/ui/navBar";
import { SiteFooter } from "../components/ui/siteFooter";
import { isLocale } from "../paraglide/runtime.js";
import { localizedHref } from "../components/ui/href";
import { unlocalizedPath } from "../../core/pageNames";

// The parent of every localized page. The active locale comes from the URL
// prefix (the `url` strategy reads it directly), so this validates the segment
// and keeps <html lang> in sync on the client.
export default function LocaleLayout() {
    const { locale } = useParams();
    const { pathname, search, hash } = useLocation();
    const valid = isLocale(locale);

    useEffect(() => {
        if (valid && locale) {
            document.documentElement.lang = locale;
        }
    }, [valid, locale]);

    // A first segment that is not a language is either a mistyped one — "/zz/play/abc",
    // whose page survives the bad segment being dropped — or a page name that arrived with
    // no language in front of it — "/music/", "/glossary/piano/" — which is kept whole.
    // unlocalizedPath makes that call from the page names the route table declares.
    //
    // localizedHref picks the language the way the bare "/" does — the one last chosen,
    // else the browser's, else English. During prerender there is no navigator to resolve
    // against, and an unknown locale is never prerendered, so the redirect is deferred to
    // the client exactly as the root redirect does.
    if (!valid) {
        if (typeof window === "undefined") {
            return null;
        }
        // The query and the fragment travel with the page: a piece opened by a link that
        // asks for one hand, or a help page opened at a heading, keeps the ask.
        return (
            <Navigate to={localizedHref(`${unlocalizedPath(pathname)}${search}${hash}`)} replace />
        );
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
