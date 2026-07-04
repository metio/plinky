// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The persistence seam. Everything that needs to remember something across reloads
// depends on this interface, not on `localStorage` directly, so the denied-storage
// guard lives in exactly one place (the browser adapter) and a test can hand a unit
// an in-memory fake instead of a real browser store.
//
// Values are strings — callers serialize their own shape (usually JSON), which keeps
// the seam trivial and the same across every backing store.
export interface KeyValueStore {
    // The stored value for `key`, or null when absent (or when storage is unreadable).
    get(key: string): string | null;
    // Persist `value` under `key`; returns whether it was actually stored, so a caller
    // that must know (an import that could exceed quota, a save the user is told
    // succeeded) can react. A store that refuses the write returns false, not a throw.
    set(key: string, value: string): boolean;
    // Forget `key`. Best-effort, like set.
    remove(key: string): void;
    // Every key currently held, so callers can find or clear a family of keys (e.g.
    // every `plinky:mastery:*`, or a full device reset). Empty when storage is unreadable.
    keys(): string[];
}
