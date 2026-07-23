// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { Link } from "react-router";
import { m } from "../../paraglide/messages.js";
import { localizeHref } from "../../paraglide/runtime.js";
import { BrandIcon } from "./brandIcons";

// The quiet last line of every page: the German-law provider links, and the project's
// source on GitHub. Mirrors the header's hairline-and-max-width frame so the shell reads
// as one piece, keeping the accent for hover.
export function SiteFooter() {
    return (
        <footer className="mt-12 border-t border-gray-200 px-6 py-4 font-sans dark:border-gray-800">
            <div className="mx-auto flex max-w-3xl items-center justify-between">
                {/* The provider information German law requires, reachable from every page.
                The labels are the German legal terms, kept as-is in every language. */}
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <Link
                        to={localizeHref("/impressum")}
                        className="rounded-md px-1 hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-indigo-400"
                    >
                        Impressum
                    </Link>
                    <Link
                        to={localizeHref("/datenschutz")}
                        className="rounded-md px-1 hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-indigo-400"
                    >
                        Datenschutz
                    </Link>
                </div>
                <a
                    href="https://github.com/metio/plinky"
                    target="_blank"
                    rel="noreferrer"
                    aria-label={m.footer_source()}
                    className="rounded-md p-2 text-gray-500 hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-indigo-400"
                >
                    <BrandIcon brand="github" className="h-5 w-5" />
                </a>
            </div>
        </footer>
    );
}
