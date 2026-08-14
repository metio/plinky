// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the app remembers about corners you have already met.
//
// This was an eleven-step discovery checklist, and the strip that showed it is gone: the
// day's practice makes those offers where each belongs instead. One step survives, because
// something still reads it — finishing the keyboard tour is what stops the day's "learn
// one thing" from offering the tour again, and it leaves no other trace to read back.
export type DiscoveryId = "keyboardMet";

// Marked by doing it: finishing the tour records nothing else.
export const MARKABLE: readonly DiscoveryId[] = ["keyboardMet"];
