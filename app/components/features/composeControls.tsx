// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { ConfirmButton } from "../ui/confirmButton";

type ComposeControlsProps = {
    empty: boolean;
    playing: boolean;
    countingIn: boolean;
    checkpoint: number | null;
    onCountIn: () => void;
    onPlay: () => void;
    onStop: () => void;
    onSetCheckpoint: () => void;
    onResetToCheckpoint: () => void;
    onClear: () => void;
    // Step entry is on. Counting in exists to put a player on the grid before they play;
    // when the notes are being written rather than played there is nothing to be in time
    // with, and the click would simply run on.
    stepping?: boolean;
};

// The recording controls bar — count-in, play/stop, checkpointing, and the
// confirm-guarded clear. Leads the page so the primary action is the first
// thing in reach, above the sketch it produces.
export function ComposeControls({
    empty,
    playing,
    countingIn,
    checkpoint,
    onCountIn,
    onPlay,
    onStop,
    onSetCheckpoint,
    onResetToCheckpoint,
    onClear,
    stepping = false,
}: ComposeControlsProps) {
    return (
        <section className="space-y-2">
            <div className="flex flex-wrap gap-2">
                {/* While the count-in clicks, both buttons are ways out: the armed
                primary cancels, and the transport button reads Stop — so stopping
                works without leaving full screen. */}
                <Button
                    variant="primary"
                    onClick={countingIn ? onStop : onCountIn}
                    disabled={stepping}
                >
                    {countingIn ? m.compose_counting_in() : m.compose_count_in()}
                </Button>
                <Button
                    variant="secondary"
                    onClick={playing || countingIn ? onStop : onPlay}
                    disabled={empty && !countingIn}
                >
                    {playing || countingIn ? m.compose_stop() : m.compose_play()}
                </Button>
                <Button variant="secondary" onClick={onSetCheckpoint} disabled={empty}>
                    {m.compose_set_checkpoint()}
                </Button>
                <Button
                    variant="secondary"
                    onClick={onResetToCheckpoint}
                    disabled={checkpoint === null}
                >
                    {checkpoint === null
                        ? m.compose_reset_checkpoint()
                        : m.compose_reset_checkpoint_at({ count: checkpoint })}
                </Button>
                <ConfirmButton
                    onConfirm={onClear}
                    confirmLabel={m.compose_clear_confirm()}
                    disabled={empty}
                >
                    {m.compose_clear()}
                </ConfirmButton>
            </div>
            {/* A disabled primary with no reason beside it is a small mystery; this is the
                reason. */}
            {stepping && <p className="text-xs text-muted">{m.compose_count_in_stepping()}</p>}
        </section>
    );
}
