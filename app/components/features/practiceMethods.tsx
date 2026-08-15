// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type MethodId, METHODS } from "../../../core/practiceMethods";
import { Card } from "../ui/card";
import { sectionHeadingClasses } from "../ui/classes";
import { m } from "../../paraglide/messages.js";

const NAME: Record<MethodId, () => string> = {
    chunking: () => m.method_chunking_name(),
    slow: () => m.method_slow_name(),
    handsApart: () => m.method_hands_apart_name(),
    hearingFirst: () => m.method_hearing_first_name(),
    interleaving: () => m.method_interleaving_name(),
    spacing: () => m.method_spacing_name(),
};

const HOW: Record<MethodId, () => string> = {
    chunking: () => m.method_chunking_how(),
    slow: () => m.method_slow_how(),
    handsApart: () => m.method_hands_apart_how(),
    hearingFirst: () => m.method_hearing_first_how(),
    interleaving: () => m.method_interleaving_how(),
    spacing: () => m.method_spacing_how(),
};

const WHY: Record<MethodId, () => string> = {
    chunking: () => m.method_chunking_why(),
    slow: () => m.method_slow_why(),
    handsApart: () => m.method_hands_apart_why(),
    hearingFirst: () => m.method_hearing_first_why(),
    interleaving: () => m.method_interleaving_why(),
    spacing: () => m.method_spacing_why(),
};

// Six ways to practise: what each one is, how long a go at it takes, and why it works.
//
// Nothing here carries an action. Three of the six are done with a control inside a run's
// set-up panel, so a button could only ever land on the catalogue and leave the reader to
// find the control — and four of them pointed at the library, which made a page of advice
// read as a row of ways to go somewhere else. The reading is the point; the practice is
// wherever the player already was.
export function PracticeMethods() {
    return (
        <section className="space-y-4">
            <h2 className={sectionHeadingClasses}>{m.methods_title()}</h2>
            <p className="text-sm text-muted">{m.methods_intro()}</p>

            <ul className="space-y-4">
                {METHODS.map((method) => (
                    <li key={method.id}>
                        <Card className="space-y-2">
                            <div className="flex flex-wrap items-baseline gap-x-3">
                                <h3 className="text-base font-semibold text-ink">
                                    {NAME[method.id]()}
                                </h3>
                                <span className="text-xs text-muted">
                                    {m.methods_dose({ count: method.minutes })}
                                </span>
                            </div>
                            <p className="text-sm text-body">{HOW[method.id]()}</p>
                            <p className="text-sm text-muted">{WHY[method.id]()}</p>
                        </Card>
                    </li>
                ))}
            </ul>
        </section>
    );
}
