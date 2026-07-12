// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
}: ComposeControlsProps) {
    return (
        <section className="flex flex-wrap gap-2">
            {/* While the count-in clicks, both buttons are ways out: the armed
                primary cancels, and the transport button reads Stop — so stopping
                works without leaving full screen. */}
            <Button variant="primary" onClick={countingIn ? onStop : onCountIn}>
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
        </section>
    );
}
