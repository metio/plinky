// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { Navigate } from "react-router";
import { localizeHref } from "../paraglide/runtime.js";

// The bare "/" carries no locale, so it redirects to the localized home. On the
// client getLocale() resolves via preferredLanguage (the browser's language),
// so a German visitor lands on /de/. During prerender there is no navigator, so
// this renders nothing and the client performs the redirect after load.
export default function LocaleRedirect() {
    if (typeof window === "undefined") {
        return null;
    }
    return <Navigate to={localizeHref("/")} replace />;
}
