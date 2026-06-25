// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect } from "react";
import { Outlet, useParams } from "react-router";
import { isLocale } from "../paraglide/runtime.js";

// The parent of every localized page. The active locale comes from the URL
// prefix (the `url` strategy reads it directly), so this only validates the
// segment and keeps <html lang> in sync on the client.
export default function LocaleLayout() {
    const { locale } = useParams();

    if (!isLocale(locale)) {
        // An unknown locale prefix is a 404, surfaced by the root ErrorBoundary.
        throw new Response("Not Found", { status: 404 });
    }

    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    return <Outlet />;
}
