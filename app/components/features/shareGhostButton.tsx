// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { encodeGhost } from "../../lib/recording";
import { SITE_URL } from "../../../core/site";
import { m } from "../../paraglide/messages.js";
import { localizeHref } from "../../paraglide/runtime.js";
import { Button, IconButton } from "../ui/button";
import { GhostIcon } from "../ui/icons";

// Hand a run to a friend as a link they open to race it. The onsets are any run's
// note timings — a saved take, or your auto-saved last run — and the link points back
// at this piece with the ghost packed into ?ghost=. Native share sheet where
// available, else the clipboard with a brief confirmation. Rendered icon-only among a
// take's row of controls, or with its label as a standalone challenge button.
export function ShareGhostButton({
    id,
    title,
    onsets,
    label,
    showLabel = false,
}: {
    // The song id, so the link points back at this piece.
    id: string;
    title: string;
    // The run's note onsets to pack into the link.
    onsets: number[];
    label: string;
    // Icon-only with `label` as the accessible name (in a row of icons), or a button
    // with the label visible (standalone).
    showLabel?: boolean;
}) {
    // Briefly confirm a clipboard copy on the surface where no native share sheet ran.
    const [copied, setCopied] = useState(false);
    const share = async () => {
        const url = `${SITE_URL}${localizeHref(`/play/${id}`)}?ghost=${encodeGhost(onsets)}`;
        try {
            if (typeof navigator.share === "function") {
                await navigator.share({ url, text: m.ghost_share_boast({ title }) });
            } else {
                await navigator.clipboard?.writeText(url);
                setCopied(true);
            }
        } catch {
            // A cancelled share or a blocked clipboard needs no message.
        }
    };
    const copiedNote = copied && (
        <span className="text-xs text-fuchsia-600 dark:text-fuchsia-400">
            {m.takes_link_copied()}
        </span>
    );
    if (showLabel) {
        return (
            <div className="flex items-center gap-2">
                <Button onClick={share} className="text-fuchsia-600 dark:text-fuchsia-400">
                    <GhostIcon />
                    {label}
                </Button>
                {copiedNote}
            </div>
        );
    }
    return (
        <span className="inline-flex items-center gap-1">
            {copiedNote}
            <IconButton
                label={label}
                onClick={share}
                className="text-fuchsia-600 dark:text-fuchsia-400"
            >
                <GhostIcon />
            </IconButton>
        </span>
    );
}
