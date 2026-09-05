// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which recording answers a given key and velocity. Split from the SFZ reader so the
// browser can ask the same question the Node side does without reaching for a filesystem:
// one mapping, used in both places, is the only way the two can agree about what a piece
// should sound like.

// The recording that answers this key at this velocity. A pitch outside the sampled range
// falls to the nearest region, which is what the library's own lokey/hikey spans do at the
// ends of the keyboard.
// The lookup is core's: the app plays through the same one, and a copy here had already
// drifted in what it answered for a note nothing covers.
export { regionFor } from "../../core/sampledPiano.ts";
