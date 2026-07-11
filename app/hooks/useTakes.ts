// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import type { Take } from "../../core/takes";
import type { AppServices } from "../contexts/services";

// The score's saved takes as live state over the takes store: loading the list
// when the piece changes, and keeping it in sync through saves and deletes.
// Both mutations re-render from the list the store actually holds, so a refused
// write (storage full) keeps showing the truth instead of an optimistic copy.
export function useTakes(store: AppServices["takes"], id: string) {
    const [takes, setTakes] = useState<Take[]>([]);

    useEffect(() => {
        setTakes(store.list(id));
    }, [id, store.list]);

    // Returns whether the write landed, for callers with their own "saved" note.
    const save = (take: Take): boolean => {
        const stored = store.save(id, take);
        setTakes(stored.takes);
        return stored.stored;
    };

    const remove = (takeId: string): void => {
        setTakes(store.remove(id, takeId).takes);
    };

    return { takes, save, remove };
}
