// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";
import { type Brand, BrandIcon } from "./brandIcons";

const CHANNELS: { brand: Brand; label: string; href: string }[] = [
    { brand: "instagram", label: "Instagram", href: "https://www.instagram.com/plinky.piano" },
    {
        brand: "facebook",
        label: "Facebook",
        href: "https://www.facebook.com/profile.php?id=61591963944991",
    },
    { brand: "github", label: "GitHub", href: "https://github.com/metio/plinky" },
];

// The quiet last line of every page: where to follow Plinky. Mirrors the
// header's hairline-and-max-width frame so the shell reads as one piece, and
// keeps the accent for hover — the icons are the only ornament.
export function SiteFooter() {
    return (
        <footer className="mt-12 border-t border-gray-200 px-6 py-4 font-sans dark:border-gray-800">
            <div className="mx-auto flex max-w-3xl items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {m.footer_follow()}
                </span>
                <div className="flex items-center gap-1">
                    {CHANNELS.map((channel) => (
                        <a
                            key={channel.brand}
                            href={channel.href}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={m.board_follow({ platform: channel.label })}
                            className="rounded-md p-2 text-gray-500 hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-indigo-400"
                        >
                            <BrandIcon brand={channel.brand} className="h-5 w-5" />
                        </a>
                    ))}
                </div>
            </div>
        </footer>
    );
}
