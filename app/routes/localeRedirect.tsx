// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { Navigate } from "react-router";
import { localizeHref } from "../paraglide/runtime.js";

// The bare "/" carries no locale, so it redirects to the localized home. On the
// client getLocale() resolves through the strategies: the language the player last
// chose if there is one, otherwise the browser's own, so a German visitor lands on
// /de/ either way. During prerender there is no navigator and no localStorage, so
// this renders nothing and the client performs the redirect after load.
export default function LocaleRedirect() {
    if (typeof window === "undefined") {
        return null;
    }
    return <Navigate to={localizeHref("/")} replace />;
}
