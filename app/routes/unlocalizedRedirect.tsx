// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Navigate, useLocation } from "react-router";
import { hasLocalePrefix, localizedHref } from "../components/ui/href";
import { NotFoundError } from "../lib/errorReport";

// The catch-all, which exists for one case: an address with no language in it.
//
// Every page lives under /:locale/, so a hand-typed or elderly /play/<id> matches nothing
// and lands on the not-found page — even though the piece is right there. The bare "/" has
// always redirected to the visitor's language; this does the same for every other path,
// carrying the query and the fragment across so a link that configures a run survives it.
//
// A path that DOES name a language and still matched nothing is a real miss — a page that
// never existed or has gone — so it raises the 404 the error boundary already renders.
// Without that split this route would answer for everything and the not-found page would
// become unreachable.
export default function UnlocalizedRedirect() {
    const { pathname, search, hash } = useLocation();
    // Prerendering has no window and no navigator to read a language from, so the document
    // is emitted empty and the client performs the redirect after load — the same bargain
    // the bare "/" redirect makes.
    if (typeof window === "undefined") {
        return null;
    }
    if (hasLocalePrefix(pathname)) {
        throw new NotFoundError(pathname);
    }
    return <Navigate to={localizedHref(`${pathname}${search}${hash}`)} replace />;
}
