// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
                    const assignment = makeAssignment({
                        id: typeof entry.id === "string" ? entry.id : undefined,
                        name: typeof entry.name === "string" ? entry.name : undefined,
                        description:
                            typeof entry.description === "string" ? entry.description : undefined,
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
