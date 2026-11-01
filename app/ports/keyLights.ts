// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { LitKeys } from "../../core/keyLights";

// Where lit keys go. Declarative on purpose: a caller hands over the whole picture it
// wants showing, never an instruction to light or unlight one key. The implementation
// works out the difference from what it last showed, which is what makes it safe to
// call on every render and impossible to leave a key stranded by a missed instruction.
//
// Deliberately separate from the sound path. What Klimpi plays and what Klimpi asks an
// instrument to illuminate are different messages with different timing — the whole
// point of the feature is a key that lights BEFORE it is played — so they cannot share
// one output stream.
export type KeyLightsPort = {
    // Show exactly these keys, and nothing else. Idempotent: showing the same picture
    // twice sends nothing the second time.
    show(keys: LitKeys): void;
    // Put every light out. Called on leaving a surface and on teardown — a light left
    // on outlives the page that lit it, and only the app knows to say when.
    clear(): void;
};
