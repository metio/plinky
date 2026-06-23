import type {RhythmSummary} from "./rhythm";

// A wrong note costs this much added time, so the ranking metric rewards both
// speed and accuracy in a single comparable number.
export const ERROR_PENALTY_MS = 2000;

export type TrialResult = {
    timeMs: number;
    errors: number;
    score: number;
    at: string;
};

export function scoreFor(timeMs: number, errors: number): number {
    return timeMs + errors * ERROR_PENALTY_MS;
}

function storageKey(exerciseId: string): string {
    return `plinky:best:${exerciseId}`;
}

export function loadBest(exerciseId: string): TrialResult | null {
    if (typeof localStorage === "undefined") {
        return null;
    }
    try {
        const raw = localStorage.getItem(storageKey(exerciseId));
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as TrialResult;
        return typeof parsed?.score === "number" ? parsed : null;
    } catch {
        return null;
    }
}

export function saveBest(exerciseId: string, result: TrialResult): void {
    if (typeof localStorage === "undefined") {
        return;
    }
    try {
        localStorage.setItem(storageKey(exerciseId), JSON.stringify(result));
    } catch {
        // Storage can fail in private mode or when over quota; the best score is
        // a convenience, so a failed write is not worth surfacing.
    }
}

export type RhythmBest = RhythmSummary & {at: string};

function rhythmKey(exerciseId: string): string {
    return `plinky:rhythm:${exerciseId}`;
}

// Tighter timing wins; on a tie the run with more perfect notes is better.
export function isBetterRhythm(candidate: RhythmSummary, current: RhythmBest | null): boolean {
    if (!current) {
        return true;
    }
    if (candidate.averageAbsMs !== current.averageAbsMs) {
        return candidate.averageAbsMs < current.averageAbsMs;
    }
    return candidate.perfect > current.perfect;
}

export function loadBestRhythm(exerciseId: string): RhythmBest | null {
    if (typeof localStorage === "undefined") {
        return null;
    }
    try {
        const raw = localStorage.getItem(rhythmKey(exerciseId));
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as RhythmBest;
        return typeof parsed?.averageAbsMs === "number" ? parsed : null;
    } catch {
        return null;
    }
}

export function saveBestRhythm(exerciseId: string, best: RhythmBest): void {
    if (typeof localStorage === "undefined") {
        return;
    }
    try {
        localStorage.setItem(rhythmKey(exerciseId), JSON.stringify(best));
    } catch {
        // See saveBest: a failed write of a convenience value is not surfaced.
    }
}
