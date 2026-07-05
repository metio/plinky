// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { useHintsStore } from "../../contexts/services";
import { useNews } from "../../hooks/useNews";
import { m } from "../../paraglide/messages.js";
import { CloseIcon } from "../ui/icons";

// A small "what's new" slot on the home page: one editor-published picture that
// links somewhere, fetched live from the content service so it changes without a
// redeploy. Renders nothing until (and unless) an item resolves, so a fetch
// failure or an unconfigured source is invisible. The ✕ dismisses this item for
// good — dismissal is keyed by the item's id (reusing the seen-hints store), so a
// newly published item shows again.
export function NewsBanner() {
    const item = useNews();
    const hints = useHintsStore();
    const [dismissed, setDismissed] = useState(false);

    if (!item) {
        return null;
    }
    const dismissKey = `news:${item.id}`;
    if (dismissed || hints.seen(dismissKey)) {
        return null;
    }

    const aspect = item.aspect && item.aspect > 0 ? item.aspect : 16 / 9;
    const dismiss = () => {
        hints.markSeen(dismissKey);
        setDismissed(true);
    };

    return (
        <section
            aria-label={m.news_label()}
            className="relative overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
        >
            <button
                type="button"
                onClick={dismiss}
                aria-label={m.action_dismiss()}
                className="absolute right-2 top-2 z-10 rounded-full bg-black/40 p-1 leading-none text-white backdrop-blur transition hover:bg-black/60"
            >
                <CloseIcon className="h-4 w-4" />
            </button>
            <a
                href={item.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
            >
                {/* The reserved aspect box keeps the picture from shifting the page
                    as it loads — the space is claimed before the bytes arrive. */}
                <div
                    style={{ aspectRatio: String(aspect) }}
                    className="w-full bg-gray-100 dark:bg-gray-800"
                >
                    <img
                        src={item.imageUrl}
                        alt={item.imageAlt}
                        loading="lazy"
                        className="h-full w-full object-cover"
                    />
                </div>
                {item.headline && (
                    <p className="px-4 py-3 text-sm font-medium text-gray-800 group-hover:text-indigo-700 dark:text-gray-100 dark:group-hover:text-indigo-300">
                        {item.headline}
                    </p>
                )}
            </a>
        </section>
    );
}
