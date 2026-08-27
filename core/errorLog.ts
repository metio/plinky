// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What went wrong on this device lately.
//
// A crash during render is caught by a boundary, which shows the reader a fallback and
// a link that reports it. Nothing outside render is caught at all: a rejected promise,
// a throw from an event handler or a timer, a failed decode in a worker. Those leave no
// boundary to fire and no fallback to offer, so the page looks well and quietly does
// less than it should — and with every push deploying straight to players, the only
// signal is somebody thinking to say so.
//
// This is the record a reader can point at. It stays on the device, and travels only if
// they choose to send it, which is the same bargain the crash page already offers.

// Ten is enough to show a pattern and small enough that a loop cannot fill the device.
export const MAX_LOGGED = 10;
// A message is whatever threw, so it is neither trusted nor bounded. A stack from a
// minified bundle runs to kilobytes and the first lines are the ones worth keeping.
export const MAX_MESSAGE = 400;

export type LoggedError = {
    // When it last happened, so a reader can tell "just now" from "last week".
    at: number;
    message: string;
    // The page it happened on — pathname only. A query string can carry a share code
    // or an assignment, which is the reader's business and not part of a fault report.
    where: string;
    // How often this same fault has been seen. A loop that throws every frame is one
    // problem, not ten, and counting it says more than ten copies would.
    count: number;
};

export type Incoming = { message: string; where: string; at: number };

// Trim to one line's worth of detail, since the rest of a minified stack rarely
// distinguishes two faults that the first line does not.
function tidy(message: string): string {
    const collapsed = message.replace(/\s+/g, " ").trim();
    return collapsed.length > MAX_MESSAGE ? `${collapsed.slice(0, MAX_MESSAGE)}…` : collapsed;
}

// Fold one fault into the log, newest first.
//
// A repeat anywhere in the log is counted rather than appended, and moves to the front:
// two faults alternating in a loop would otherwise push everything else out between
// them, leaving a log that records one bug twice and the previous nine not at all.
export function foldError(log: readonly LoggedError[], incoming: Incoming): LoggedError[] {
    const message = tidy(incoming.message);
    const where = incoming.where;
    const seen = log.find((one) => one.message === message && one.where === where);
    const rest = log.filter((one) => one !== seen);
    const head: LoggedError = {
        at: incoming.at,
        message,
        where,
        count: (seen?.count ?? 0) + 1,
    };
    return [head, ...rest].slice(0, MAX_LOGGED);
}

// Read back whatever is on the device, dropping anything that is not a fault this
// version understands. A log is a diagnostic: a malformed entry is worth losing
// silently, and never worth failing a page load over.
export function parseErrorLog(raw: unknown): LoggedError[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const out: LoggedError[] = [];
    for (const entry of raw) {
        if (typeof entry !== "object" || entry === null) {
            continue;
        }
        const { at, message, where, count } = entry as Record<string, unknown>;
        if (
            typeof at !== "number" ||
            !Number.isFinite(at) ||
            typeof message !== "string" ||
            typeof where !== "string" ||
            typeof count !== "number" ||
            !Number.isFinite(count) ||
            count < 1
        ) {
            continue;
        }
        out.push({ at, message: tidy(message), where, count: Math.floor(count) });
    }
    return out.slice(0, MAX_LOGGED);
}
