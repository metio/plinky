// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { useCopied } from "../../hooks/useCopied";
import { m } from "../../paraglide/messages.js";
import { SITE_URL } from "../../../core/site";
import { type Brand, BrandIcon } from "../ui/brandIcons";

// The platforms offered as one-tap links, each opening its share composer with the
// text prefilled. Facebook's composer takes a URL (plus the text as a quote) rather
// than free text; Instagram and TikTok have no web composer at all — Instagram is
// offered as an image share (the card PNG through the system share sheet, where the
// app appears), and TikTok stays behind the generic Share button.
const SHARE_TARGETS: { brand: Brand; label: string; href: (text: string) => string }[] = [
    { brand: "x", label: "X", href: (t) => `https://x.com/intent/post?text=${t}` },
    {
        brand: "bluesky",
        label: "Bluesky",
        href: (t) => `https://bsky.app/intent/compose?text=${t}`,
    },
    {
        brand: "threads",
        label: "Threads",
        href: (t) => `https://www.threads.net/intent/post?text=${t}`,
    },
    { brand: "whatsapp", label: "WhatsApp", href: (t) => `https://wa.me/?text=${t}` },
    {
        brand: "facebook",
        label: "Facebook",
        href: (t) =>
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL)}&quote=${t}`,
    },
];

const LINK =
    "rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300";

// Rasterises a self-contained SVG card to a PNG and either shares it as a file
// (mobile) or downloads it. The card is self-contained, so the canvas stays untainted
// and can be exported.
async function saveImage(svg: string, boast: string): Promise<void> {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1350;
        canvas.getContext("2d")?.drawImage(image, 0, 0);
        const png = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/png"),
        );
        if (!png) {
            return;
        }
        const file = new File([png], "plinky.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], text: boast });
            return;
        }
        const link = URL.createObjectURL(png);
        const anchor = document.createElement("a");
        anchor.href = link;
        anchor.download = "plinky.png";
        anchor.click();
        URL.revokeObjectURL(link);
    } finally {
        URL.revokeObjectURL(url);
    }
}

// Copy / save-image / per-platform buttons shared by every card. `text` is the
// clipboard and social-link payload; `imageSvg` rasterises to the shareable PNG, with
// `imageText` as the accompanying caption when handed to the system share sheet.
export function ShareButtons({
    text,
    imageSvg,
    imageText,
}: {
    text: string;
    imageSvg: string;
    imageText: string;
}) {
    // The "Copied!" label reverts after a moment.
    const [copied, flashCopied] = useCopied();
    // Whether this device can hand a file to the system share sheet — the only web
    // path to Instagram and TikTok. Resolved after mount: the prerendered HTML is
    // device-agnostic, so the button reads "Save image" until the client confirms.
    const [canShareFiles, setCanShareFiles] = useState(false);
    useEffect(() => {
        setCanShareFiles(
            typeof navigator !== "undefined" &&
                typeof navigator.share === "function" &&
                typeof navigator.canShare === "function",
        );
    }, []);

    return (
        <div className="flex flex-wrap items-center gap-2">
            <button
                type="button"
                onClick={() => {
                    // Confirm "Copied!" only once the write actually lands — optional
                    // chaining short-circuits the whole chain when the Clipboard API is
                    // absent, and the catch covers a denied or failed write.
                    navigator.clipboard
                        ?.writeText(text)
                        .then(() => flashCopied())
                        .catch(() => {});
                }}
                className={LINK}
            >
                {copied ? m.share_copied() : m.share_copy()}
            </button>
            <button
                type="button"
                // A cancelled share or a failed rasterise rejects; saving the card is
                // best-effort, so swallow it rather than crash the page.
                onClick={() => saveImage(imageSvg, imageText).catch(() => {})}
                className={LINK}
            >
                {canShareFiles ? m.share_share() : m.share_image()}
            </button>
            {SHARE_TARGETS.map((target) => (
                <a
                    key={target.brand}
                    href={target.href(encodeURIComponent(text))}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={m.share_on({ platform: target.label })}
                    title={m.share_on({ platform: target.label })}
                    className={`${LINK} inline-flex items-center`}
                >
                    <BrandIcon brand={target.brand} />
                </a>
            ))}
            <button
                type="button"
                // Instagram has no web composer, but it's an image platform and the
                // card is an image: hand the PNG to the system share sheet (where
                // Instagram appears), or save it and open Instagram to post there.
                onClick={() => {
                    if (!canShareFiles) {
                        window.open("https://www.instagram.com/", "_blank", "noreferrer");
                    }
                    saveImage(imageSvg, imageText).catch(() => {});
                }}
                aria-label={m.share_on({ platform: "Instagram" })}
                title={m.share_on({ platform: "Instagram" })}
                className={`${LINK} inline-flex items-center`}
            >
                <BrandIcon brand="instagram" />
            </button>
        </div>
    );
}
