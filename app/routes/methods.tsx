// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type MethodId, METHODS } from "../../core/practiceMethods";
import { routeMeta, webPageData } from "../../core/site";
import { buttonClasses } from "../components/ui/button";
import { LocalizedLink as Link } from "../components/ui/localizedLink";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/methods";
import { PageHeader } from "../components/ui/pageHeader";

export function meta(_args: Route.MetaArgs) {
    return [
        ...routeMeta(m.methods_title(), m.meta_methods_description()),
        {
            "script:ld+json": webPageData(
                m.methods_title(),
                m.meta_methods_description(),
                getLocale(),
                "/methods/",
                "CollectionPage",
            ),
        },
    ];
}

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

// Ways to practise, each pointing at the control in Plinky that does it. Nothing on
// this page prescribes a routine: it names six things a teacher would suggest, says
// what each is for, and hands the reader straight to the place they can try it.
export default function MethodsRoute() {
    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.methods_title()} hint={m.methods_intro()} />

            <ul className="space-y-4">
                {METHODS.map((method) => (
                    <li
                        key={method.id}
                        className="space-y-2 rounded-lg border border-line bg-surface p-4"
                    >
                        <div className="flex flex-wrap items-baseline gap-x-3">
                            <h2 className="font-medium text-body">{NAME[method.id]()}</h2>
                            <span className="text-xs text-muted">
                                {m.methods_dose({ count: method.minutes })}
                            </span>
                        </div>
                        <p className="text-sm text-body">{HOW[method.id]()}</p>
                        <p className="text-xs text-muted">{WHY[method.id]()}</p>
                        {/* Three of these are done with a control inside a run's set-up
                            panel, so the honest offer is a piece to try them on rather
                            than "Try it" landing on a catalogue. The other three lead
                            straight to the thing itself. */}
                        <Link className={buttonClasses("secondary")} to={method.href}>
                            {method.href === "/library/" ? m.today_browse() : m.methods_try()}
                        </Link>
                    </li>
                ))}
            </ul>
        </main>
    );
}
