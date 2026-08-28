// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { m } from "../../paraglide/messages.js";
import { BrandIcon } from "./brandIcons";
import { CHANNELS } from "../../../core/social";
import { HeartIcon } from "./icons";
import { LocalizedLink as Link } from "./localizedLink";

// The quiet last line of every page: where to follow Plinky. Mirrors the
// header's hairline-and-max-width frame so the shell reads as one piece, and
// keeps the accent for hover — the icons are the only ornament.
export function SiteFooter() {
    return (
        <footer className="mt-12 border-t border-line px-6 py-4 font-sans print:hidden">
            {/* Wraps rather than shrinks. Four channels, two legal pages and the way to
                the people behind Plinky do not fit across a phone in one line, and the
                fixes that keep them on one — dropping the About label, tightening the
                icons — cost the thing each of them was for. Stacked and centred is what a
                narrow screen has room for; the row returns as soon as there is width. */}
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-muted">
                    {/* The way to the people behind Plinky. The heart says how they feel
                        about it; the word says where the link goes, which a heart on its
                        own never did — it sat beside two labelled legal pages as the one
                        thing a curious visitor had to guess at. */}
                    <Link
                        to="/about"
                        className="group flex items-center gap-1.5 rounded-md p-1 hover:text-plink focus-visible:ring-2 focus-visible:ring-plink"
                    >
                        <HeartIcon
                            filled
                            className="h-5 w-5 text-faint opacity-70 transition group-hover:text-plink group-hover:opacity-100"
                        />
                        {m.nav_about()}
                    </Link>
                </div>
                {/* The provider information German law requires, reachable from every page.
                The labels are the German legal terms, kept as-is in every language. */}
                <div className="flex items-center gap-3 text-sm text-muted">
                    <Link
                        to="/impressum"
                        className="rounded-md px-1 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent-ring"
                    >
                        Impressum
                    </Link>
                    <Link
                        to="/datenschutz"
                        className="rounded-md px-1 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent-ring"
                    >
                        Datenschutz
                    </Link>
                </div>
                <div className="flex items-center gap-1">
                    {CHANNELS.map((channel) => (
                        <a
                            key={channel.brand}
                            href={channel.href}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={m.board_follow({ platform: channel.label })}
                            className="rounded-md p-2 text-muted hover:text-accent focus-visible:ring-2 focus-visible:ring-accent-ring"
                        >
                            <BrandIcon brand={channel.brand} className="h-5 w-5" />
                        </a>
                    ))}
                </div>
            </div>
        </footer>
    );
}
