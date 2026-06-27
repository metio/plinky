// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { buildExerciseId, type ExerciseConfig, type Hands, isArpeggio } from "../lib/exerciseGen";
import { m } from "../paraglide/messages.js";
import { LocalizedLink as Link } from "./localizedLink";

// Form controls for a generated exercise: octaves, hands, and (for arpeggios)
// inversion. Each option links to the play page for that variant's id, so the
// exercise regenerates and the URL stays shareable and mastery-tracked.
const BTN = "rounded-md border px-3 py-1 text-sm tabular-nums";
const ON = "border-indigo-600 bg-indigo-600 text-white";
const OFF =
    "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
            </span>
            {children}
        </div>
    );
}

export function ExerciseForms({ config }: { config: ExerciseConfig }) {
    const to = (patch: Partial<ExerciseConfig>) =>
        `/play/${buildExerciseId({ ...config, ...patch })}`;
    const handOptions: [Hands, string][] = [
        ["right", m.exercise_hand_right()],
        ["left", m.exercise_hand_left()],
        ["both", m.exercise_hand_both()],
        ...(isArpeggio(config.type)
            ? []
            : ([["contrary", m.exercise_hand_contrary()]] as [Hands, string][])),
    ];
    const inversions: [0 | 1 | 2, string][] = [
        [0, m.exercise_inv_root()],
        [1, m.exercise_inv_first()],
        [2, m.exercise_inv_second()],
    ];

    return (
        <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
            <Row label={m.exercise_octaves()}>
                {([1, 2] as const).map((octaves) => (
                    <Link
                        key={octaves}
                        to={to({ octaves })}
                        className={`${BTN} ${config.octaves === octaves ? ON : OFF}`}
                    >
                        {octaves}
                    </Link>
                ))}
            </Row>
            <Row label={m.exercise_hands()}>
                {handOptions.map(([hands, label]) => (
                    <Link
                        key={hands}
                        to={to({ hands })}
                        className={`${BTN} ${config.hands === hands ? ON : OFF}`}
                    >
                        {label}
                    </Link>
                ))}
            </Row>
            {isArpeggio(config.type) && (
                <Row label={m.exercise_inversion()}>
                    {inversions.map(([inversion, label]) => (
                        <Link
                            key={inversion}
                            to={to({ inversion })}
                            className={`${BTN} ${config.inversion === inversion ? ON : OFF}`}
                        >
                            {label}
                        </Link>
                    ))}
                </Row>
            )}
        </div>
    );
}
