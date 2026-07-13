// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { decodeGhost, ghostReached } from "../../core/ghost";
import type { Hand } from "../../core/matcher";
import { GHOST_COLOR, NOTE_COLOR, PLAYED_COLOR } from "../../core/scoreCanvas";
import { fastestTakeOnsets } from "../../core/takes";
import { useServices } from "../contexts/services";
import { collectNoteElements, paintElement } from "../lib/scoreColor";

// The ghost race: a previous run's note onsets replayed against the clock while
// you practice, shown as a moving marker on the staff and a position on the race
// track. This hook owns the whole feature — which ghost to race (your fastest
// take, your last run, or a friend's ?ghost= link), advancing it on the run
// clock, and walking its colour along the captured note groups — so the play
// surface only arms it at run start and renders its readouts.
export function useGhostRace({
    id,
    canShareGhost,
    getOsmd,
    practicing,
    complete,
    done,
    runStartedAt,
}: {
    id: string;
    canShareGhost?: boolean;
    getOsmd: () => OpenSheetMusicDisplay | null;
    // The matcher's run state: whether a run is live, whether it finished, and
    // how many positions the player has cleared (the restore colour boundary).
    practicing: boolean;
    complete: boolean;
    done: number;
    // Wall-clock of the run's first note — the race's starting gun; 0 until it
    // lands, which holds the ghost at the line.
    runStartedAt: () => number;
}) {
    const services = useServices();
    const { scheduler } = services;
    // The onsets being raced this run — and how far the ghost has reached as the
    // run's clock elapses.
    const [ghost, setGhost] = useState<number[] | null>(null);
    const [ghostDone, setGhostDone] = useState(0);
    // The rendered note groups per step, captured when a race starts, and which
    // step currently wears the ghost's colour — so the marker can move along the
    // staff and be restored as it leaves each note.
    const ghostNotesRef = useRef<SVGGElement[][]>([]);
    const ghostMarkRef = useRef(-1);
    // The ghost saved for this score (own last run, or a friend's loaded by link) —
    // the source for the share link. Mirrors storage so the share button reacts.
    const [storedGhost, setStoredGhost] = useState<number[] | null>(null);
    const [sharedFromLink, setSharedFromLink] = useState(false);

    const [searchParams] = useSearchParams();
    // Adopt a ghost handed over by a ?ghost= link so the player can race a friend's
    // run; otherwise the score's own stored ghost is the one to race and to re-share.
    useEffect(() => {
        if (!canShareGhost) {
            setStoredGhost(null);
            return;
        }
        const shared = decodeGhost(searchParams.get("ghost") ?? "");
        if (shared) {
            services.ghosts.save(id, shared);
            setStoredGhost(shared);
            setSharedFromLink(true);
        } else {
            setStoredGhost(services.ghosts.load(id));
            setSharedFromLink(false);
        }
    }, [id, canShareGhost, searchParams, services.ghosts.save, services.ghosts.load]);

    // Advance the ghost on the live clock while practicing — it starts with the
    // player's first note, so the two race from the same moment.
    useEffect(() => {
        if (!practicing || !ghost) {
            return;
        }
        const tick = () => {
            const startedAt = runStartedAt();
            if (startedAt > 0) {
                setGhostDone(ghostReached(ghost, performance.now() - startedAt));
            }
        };
        const timer = scheduler.every(50, tick);
        return () => scheduler.cancel(timer);
    }, [practicing, ghost, runStartedAt, scheduler]);

    // Move the ghost's colour onto the note it has currently reached, restoring the
    // one it leaves to green if the player has already played it there, else black.
    // Captured note groups outlive a render, so this paints the real staff.
    useEffect(() => {
        const steps = ghostNotesRef.current;
        if (steps.length === 0) {
            return;
        }
        const restore = (step: number) => {
            const base = done > step ? PLAYED_COLOR : NOTE_COLOR;
            for (const element of steps[step] ?? []) {
                paintElement(element, base);
            }
        };
        const previous = ghostMarkRef.current;
        // Off the staff once the race is over or paused.
        if (!ghost || !practicing || complete) {
            if (previous >= 0) {
                restore(previous);
                ghostMarkRef.current = -1;
            }
            return;
        }
        const target = Math.min(ghostDone, steps.length - 1);
        if (target === previous) {
            return;
        }
        if (previous >= 0) {
            restore(previous);
        }
        for (const element of steps[target] ?? []) {
            paintElement(element, GHOST_COLOR);
        }
        ghostMarkRef.current = target;
    }, [ghostDone, ghost, practicing, complete, done]);

    // Arm the race for a starting run: pick the ghost to chase — your fastest
    // complete take, falling back to the last run (or a friend's shared ghost) —
    // and capture each step's rendered notes (post-render) so its colour can mark,
    // and move along, the actual staff. A partial run (a takeover from Listen) has
    // no full-piece ghost to race — chasing one from the middle would desync the
    // marker — and an ephemeral piece keeps no ghost at all.
    const arm = useCallback(
        ({
            partial,
            ephemeral,
            raceGhost,
            hand,
        }: {
            partial: boolean;
            ephemeral?: boolean;
            raceGhost: boolean;
            hand: Hand;
        }) => {
            const racing =
                partial || ephemeral || !raceGhost
                    ? null
                    : (fastestTakeOnsets(services.takes.list(id)) ??
                      storedGhost ??
                      services.ghosts.load(id));
            setGhost(racing);
            setGhostDone(0);
            ghostMarkRef.current = -1;
            const osmd = getOsmd();
            ghostNotesRef.current = racing && osmd ? collectNoteElements(osmd, hand) : [];
        },
        [id, storedGhost, services.takes, services.ghosts, getOsmd],
    );

    // A finished full run became this score's new ghost (recordRun saved it);
    // mirror it so the share button and the next race react.
    const adoptOwnRun = useCallback((onsets: number[]) => {
        setStoredGhost(onsets);
        setSharedFromLink(false);
    }, []);

    return { ghost, ghostDone, storedGhost, sharedFromLink, arm, adoptOwnRun };
}
