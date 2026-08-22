// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { lessonById } from "../../core/theoryCourse";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createStringSetStore } from "./jsonStore";

// Which lessons of the theory course have been met. A lesson counts as met the first
// time its demonstration is played, because hearing the idea *is* the lesson — there is
// nothing to tick off, and a course that asked you to mark your own homework would be
// the checklist this app keeps taking out.
//
// It exists so the course knows where you are: the day's practice offers the next lesson
// rather than a rotating guess, and stops offering the course at all once it is finished.
// Nothing here expires and nothing counts consecutive anything.

const KEY = "plinky:theory";

export type TheoryStore = {
    met(): ReadonlySet<string>;
    markMet(id: string): void;
    subscribe(onChange: () => void): () => void;
};

export function createTheoryStore(kv: KeyValueStore): TheoryStore {
    // An id that is not a lesson any more — a course reshuffled under a device that
    // still remembers the old one — is dropped on read rather than counted.
    const store = createStringSetStore(kv, KEY, (id): id is string => lessonById(id) !== null);
    return {
        met: store.load,
        markMet(id) {
            if (lessonById(id) === null || store.load().has(id)) {
                return;
            }
            store.save(new Set([...store.load(), id]));
        },
        subscribe: store.subscribe,
    };
}
