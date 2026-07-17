// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { earItemById } from "./earCatalog";

// Everything the grade ladder holds is a "practisable": a piece you open as a score, or
// an ear exercise you run as a drill. They share a grade, a cost and a mastery record, so
// the ladder treats them as one — but you practise them on different surfaces, and that
// difference is the KIND. Carrying it as data (set once where an item is built) is what
// lets every reader dispatch on it instead of guessing the kind back from an id string.
export type ItemKind = "piece" | "ear";

// Where to go to practise an item — the one place that knows a piece opens in /play and
// an ear exercise opens its drill on /ear. An ear link carries the exercise and level so
// the page opens on the very drill that was suggested, not a default.
export function practiceHref(item: { id: string; kind: ItemKind }): string {
    if (item.kind === "ear") {
        const ear = earItemById(item.id);
        if (!ear) {
            return "/ear";
        }
        const level = ear.level ?? 0;
        return `/ear?exercise=${ear.exercise}&level=${level}`;
    }
    return `/play/${item.id}`;
}
