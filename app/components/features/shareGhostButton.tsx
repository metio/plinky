// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { encodeGhost } from "../../../core/ghost";
import { SITE_URL } from "../../../core/site";
import { useAnalytics } from "../../contexts/services";
import { useCopied } from "../../hooks/useCopied";
import { m } from "../../paraglide/messages.js";
import { Button, type ButtonVariant, IconButton } from "../ui/button";
import { GhostIcon } from "../ui/icons";
import { localizedHref } from "../ui/href";

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
    variant = "secondary",
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
    // Matches the surrounding row: the quiet ghost look inside a toolbar strip,
    // the tinted default when standalone.
    variant?: ButtonVariant;
}) {
    // Briefly confirm a clipboard copy on the surface where no native share sheet ran.
    const [copied, flashCopied] = useCopied();
    const analytics = useAnalytics();
    const share = async () => {
        const url = `${SITE_URL}${localizedHref(`/play/${id}`)}?ghost=${encodeGhost(onsets)}`;
        try {
            if (typeof navigator.share === "function") {
                await navigator.share({ url, text: m.ghost_share_boast({ title }) });
                analytics.track("share", { context: "ghost", channel: "share_sheet" });
            } else {
                await navigator.clipboard?.writeText(url);
                analytics.track("share", { context: "ghost", channel: "copy" });
                flashCopied();
            }
        } catch {
            // A cancelled share or a blocked clipboard needs no message — and reports
            // nothing either, so only a landed share counts.
        }
    };
    const copiedNote = copied && (
        <span className="text-xs text-ghost-text">{m.takes_link_copied()}</span>
    );
    if (showLabel) {
        return (
            // Sharing sends its own `share` event, so the click tracker skips this.
            <div className="flex items-center gap-2" data-analytics-skip="">
                <Button onClick={share} className="text-ghost-text">
                    <GhostIcon />
                    {label}
                </Button>
                {copiedNote}
            </div>
        );
    }
    return (
        <span className="inline-flex items-center gap-1" data-analytics-skip="">
            {copiedNote}
            <IconButton label={label} onClick={share} variant={variant} className="text-ghost-text">
                <GhostIcon />
            </IconButton>
        </span>
    );
}
