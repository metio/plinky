// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type Assignment, makeAssignment } from "../../core/assignment";
import { isRecord } from "../../core/guards";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, parseJson } from "./jsonStore";

// The received/authored assignments kept on this device (see core/assignment
// for the model, validation and share-link codec).

const KEY = "plinky:assignments";

export type AssignmentsStore = {
    list(): Assignment[];
    // Upsert by id, so re-saving an edited assignment refreshes it in place.
    // False when the write fails (e.g. storage quota), so a caller can say so.
    save(assignment: Assignment): boolean;
    remove(id: string): boolean;
    subscribe(onChange: () => void): () => void;
};

export function createAssignmentsStore(kv: KeyValueStore): AssignmentsStore {
    const store = createJsonStore<Assignment[]>(kv, KEY, (raw) =>
        parseJson(raw, [], (parsed) => {
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed
                .map((entry) => {
                    if (!isRecord(entry) || !Array.isArray(entry.items)) {
                        return null;
                    }
                    // Every field, every time. What this list omits, makeAssignment
                    // defaults away and the next save writes back without — so a
                    // field left out here is not merely unread, it is deleted on the
                    // first read-then-write. assignmentsStore.test.ts round-trips a
                    // fully populated assignment to keep the two in step.
                    const assignment = makeAssignment({
                        id: typeof entry.id === "string" ? entry.id : undefined,
                        origin: typeof entry.origin === "string" ? entry.origin : undefined,
                        name: typeof entry.name === "string" ? entry.name : undefined,
                        description:
                            typeof entry.description === "string" ? entry.description : undefined,
                        dueOn: typeof entry.dueOn === "string" ? entry.dueOn : undefined,
                        items: entry.items,
                    });
                    return assignment.items.length > 0 ? assignment : null;
                })
                .filter((entry): entry is Assignment => entry !== null);
        }),
    );

    return {
        list: store.load,
        save(assignment) {
            const existing = store.load();
            const at = existing.findIndex((entry) => entry.id === assignment.id);
            if (at === -1) {
                return store.save([...existing, assignment]);
            }
            // Overwrite the matching slot so an edit keeps the assignment where it
            // was in the list rather than jumping to the end.
            const next = [...existing];
            next[at] = assignment;
            return store.save(next);
        },
        remove(id) {
            return store.save(store.load().filter((entry) => entry.id !== id));
        },
        subscribe: store.subscribe,
    };
}
