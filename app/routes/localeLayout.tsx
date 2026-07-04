// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect } from "react";
import { Outlet, useParams } from "react-router";
import { BottomNav } from "../components/ui/navBar";
import { useSongSource } from "../contexts/services";
import { isLocale } from "../paraglide/runtime.js";

// The parent of every localized page. The active locale comes from the URL
// prefix (the `url` strategy reads it directly), so this only validates the
// segment and keeps <html lang> in sync on the client.
export default function LocaleLayout() {
    const songs = useSongSource();
    const { locale } = useParams();

    if (!isLocale(locale)) {
        // An unknown locale prefix is a 404, surfaced by the root ErrorBoundary.
        throw new Response("Not Found", { status: 404 });
    }

    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    // On first run, seed a few songs per grade into the library so it's useful out
    // of the box; guarded so it happens once.
    useEffect(() => {
        songs.ensureSeeded();
    }, [songs.ensureSeeded]);

    return (
        <>
            {/* Room for the fixed mobile tab bar so it never covers the last of a page. */}
            <div className="pb-20 sm:pb-0">
                <Outlet />
            </div>
            <BottomNav />
        </>
    );
}
