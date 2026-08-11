// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { GRADE_COLOR, type Letter } from "../../../core/grade";

// The big result letter, in the grade's colour — the anchor of every result card.
export function GradeLetter({ letter }: { letter: Letter }) {
    return <div className={`text-5xl font-bold leading-none ${GRADE_COLOR[letter]}`}>{letter}</div>;
}
