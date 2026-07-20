// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";

// "Not sure what to play? Let Plinky choose." One tap opens a piece at the edge of the
// player's ability, varying the pick each press — a friction-free way into a run for
// someone who just wants to sit down and play. Presentational: the parent owns which
// piece a press resolves to and where it goes.
export function SurpriseButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm dark:border-indigo-800 dark:bg-gray-900 dark:text-indigo-300 dark:hover:border-indigo-700"
        >
            <span aria-hidden="true">🎲</span>
            {m.surprise_me()}
        </button>
    );
}
