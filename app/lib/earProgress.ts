// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { EAR_ITEMS } from "../../core/earCatalog";
import { earItemTitle } from "./earLabels";

// The ear items as they appear on the grade ladder. core/earCatalog owns their ids,
// grades and costs — the language-neutral difficulty — and earLabels gives each its
// translated title, the same split the rest of the catalogue keeps.

// Structurally a GradeCatalogItem[] — the shape is stated inline rather than imported so
// the catalogue can depend on the ear items without the ear items depending back on it.
export function earCatalogItems(): {
    id: string;
    title: string;
    grade: number;
    cost: number;
    kind: "ear";
}[] {
    return EAR_ITEMS.map((item) => ({
        id: item.id,
        title: earItemTitle(item),
        grade: item.grade,
        cost: item.cost,
        kind: "ear" as const,
    }));
}
