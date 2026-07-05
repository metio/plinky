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
    // The picture's own width/height ratio, learned once it loads, so the box
    // matches the image exactly — the whole picture shows with no crop and no
    // letterbox bars. Until then the box reserves an approximate ratio so the
    // image does not shift the page as its bytes arrive.
    const [loadedRatio, setLoadedRatio] = useState<number | undefined>(undefined);

    if (!item) {
        return null;
    }
    const dismissKey = `news:${item.id}`;
    if (dismissed || hints.seen(dismissKey)) {
        return null;
    }

    const aspect = loadedRatio ?? (item.aspect && item.aspect > 0 ? item.aspect : 16 / 9);
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
                {/* The box takes the image's own ratio once known (approximate
                    until then), and object-contain shows the whole picture — no
                    edges cropped. */}
                <div
                    style={{ aspectRatio: String(aspect) }}
                    className="w-full bg-gray-100 dark:bg-gray-800"
                >
                    <img
                        src={item.imageUrl}
                        alt={item.imageAlt}
                        loading="lazy"
                        onLoad={(event) => {
                            const { naturalWidth, naturalHeight } = event.currentTarget;
                            if (naturalWidth > 0 && naturalHeight > 0) {
                                setLoadedRatio(naturalWidth / naturalHeight);
                            }
                        }}
                        className="h-full w-full object-contain"
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
