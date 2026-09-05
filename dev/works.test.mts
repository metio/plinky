// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { matchWork } from "./works.mts";

const rows = [
    {
        id: "a",
        composer: "Friedrich Burgmüller",
        title: "Op. 100 No. 1 La candeur",
        scoreKind: "solo-piano",
    },
    {
        id: "b",
        composer: "Friedrich Burgmüller",
        title: "Op. 100 No. 2 Arabesque",
        scoreKind: "solo-piano",
    },
    { id: "c", composer: "Friedrich Burgmüller", title: "Op. 100 No. 3", scoreKind: "song" },
    { id: "d", composer: "J. S. Bach", title: "Invention No. 1", scoreKind: "solo-piano" },
];

describe("matchWork", () => {
    it("keeps the solo-piano rows whose composer and title both match, case aside", () => {
        expect(
            matchWork(rows, { composer: "burgm", title: "op\\.? ?100" }).map((r) => r.id),
        ).toEqual(["a", "b"]);
    });

    it("matches nothing for a pattern the catalogue no longer holds", () => {
        expect(matchWork(rows, { composer: "czerny", title: "op" })).toEqual([]);
    });
});
