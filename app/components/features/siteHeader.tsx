// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocalizedLink as Link } from "../ui/localizedLink";
import { m } from "../../paraglide/messages.js";
import { GradeBadge } from "./gradeBadge";
import { HeaderNav } from "../ui/navBar";
import { HelpLink } from "./helpLink";
import { Wordmark } from "../ui/wordmark";

// The bar at the top of every page: the mark, the grade you are working at, the
// destinations on a wide screen, and the two things you reach for from anywhere — help and
// settings.
//
// Its own file because it is the most-seen component in the app and had no stories at all
// while it sat inside the root layout, where nothing could render it in isolation. Every
// visual decision here — the lockup's tittle, the bouquet's five colours, the slim sticky
// bar — was going unchecked between releases.
export function SiteHeader() {
    return (
        // Paper, not a violet slab.
        //
        // The band was the logo's own colour applied to the whole of the app's chrome, and
        // that is what stopped the logo being a logo: when the header, the buttons, the
        // chips and the selected state are all one violet, the mark has nothing to stand
        // against. Violet now does two jobs and no others — it is the mark, and it is the
        // single most important action on a screen.
        //
        // What carries the brand here instead is the rule below: five colours that mean
        // nothing, which is exactly why they are free to be the flower's petals as well.
        // Sticky on a wide screen only. There, somebody deep in a long score would otherwise
        // scroll all the way back up to reach anything, and a slim bar costs a fraction of a
        // desktop's height. On a phone it stays put: the bottom tab bar is already fixed, and
        // a second fixed bar would eat a chunk of a screen that has none to spare — which is
        // why Home joined the bottom bar instead.
        <header className="bg-raised px-6 py-3 font-sans md:sticky md:top-0 md:z-40">
            <div className="mx-auto flex max-w-3xl items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* The wordmark is text (it follows the theme for free); its i is the
                        dotless ı with a pink dot drawn above, echoing the app icon's
                        accent. Decorative only — the link carries the accessible name. */}
                    <Link
                        to="/"
                        aria-label="Plinky home"
                        className="-mx-1 flex items-center gap-2 rounded-lg px-1 py-0.5 focus-visible:ring-2 focus-visible:ring-accent-ring"
                    >
                        {/* The wordless form of the mark: the tile, the keys and the falling
                            plink, with the name taken out. The name is set beside it here,
                            and at 32px the lockup's own lettering would be a smudge under a
                            legible copy of the same word. It carries its rounded silhouette
                            in its alpha, so it is NOT clipped — a radius is a guess at the
                            artwork's own curve, and one slightly tight leaves a sliver of
                            ground showing all the way round. */}
                        <img src="/icon-192.png" alt="" className="h-8 w-8 shrink-0" />
                        <Wordmark className="text-xl" />
                    </Link>
                    <GradeBadge />
                </div>
                {/* On wide screens the destinations sit inline; on phones they move to
                    the fixed bottom tab bar (BottomNav), so the header stays slim. */}
                <HeaderNav className="hidden items-center gap-1 md:flex" />
                <div className="flex items-center gap-4">
                    <HelpLink />
                    <Link
                        to="/settings"
                        aria-label={m.nav_settings()}
                        className="rounded-md p-1 text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-ring"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            className="h-5 w-5"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a7.7 7.7 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.6 6.6 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.5 6.5 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.9 6.9 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                            />
                        </svg>
                    </Link>
                </div>
            </div>
            {/* The bouquet, laid flat. Five colours that carry no meaning anywhere else in
                the app — which is what lets them be purely the brand's own furniture here
                and the flower's petals on the front page. It is a graphic, not text, so it
                only needs 3:1, and every one of the five clears that on both themes. */}
            <span aria-hidden="true" className="-mx-6 -mb-3 mt-3 flex h-[3px]">
                <span className="flex-1 bg-spark" />
                <span className="flex-1 bg-bloom-leaf" />
                <span className="flex-1 bg-bloom-sky" />
                <span className="flex-1 bg-plink" />
                <span className="flex-1 bg-bloom-rose" />
            </span>
        </header>
    );
}
