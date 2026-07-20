// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ReactNode } from "react";
import { noindexMeta, routeMeta } from "../../core/site";
import { LegalTranslationNotice } from "../components/features/legalTranslationNotice";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/datenschutz";

// The privacy policy German/EU law requires (GDPR / DSGVO). Like the Impressum
// the authoritative version is German and alone legally binding; every other
// locale renders a machine translation carrying LegalTranslationNotice. It
// describes what Plinky ACTUALLY does today: a client-only app that keeps its data
// in the browser, hosted static files, one third-party content fetch for the news
// banner, and opt-in analytics — no accounts, no cookies by default, no ads. NOTE:
// the German text is a grounded DRAFT, not vetted legal wording — verify it against
// a current generator (e.g. eRecht24) or a lawyer, and UPDATE it (and re-translate)
// before relying on the analytics/ads sections.
export function meta(_args: Route.MetaArgs) {
    // A privacy policy has no place in search results; it stays reachable from every
    // footer, so noindex it (and it is left out of the sitemap). Its translations
    // inherit the same noindex.
    return [
        ...routeMeta("Datenschutzerklärung", "Wie Plinky mit deinen Daten umgeht."),
        noindexMeta(),
    ];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            <div className="space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {children}
            </div>
        </section>
    );
}

export default function Datenschutz() {
    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <h1 className="text-2xl font-semibold">{m.datenschutz_title()}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{m.datenschutz_updated()}</p>

            <LegalTranslationNotice page="datenschutz" />

            <Section title={m.datenschutz_controller_heading()}>
                <p>
                    {m.datenschutz_controller_intro()}
                    <br />
                    Sebastian Hoß, Bremer Platz 7, 48155 Münster, {m.legal_country()}
                    <br />
                    {m.contact_email_label()}{" "}
                    <a
                        href="mailto:contact@plinky.fun"
                        className="text-indigo-700 hover:underline dark:text-indigo-300"
                    >
                        contact@plinky.fun
                    </a>
                </p>
            </Section>

            <Section title={m.datenschutz_short_heading()}>
                <p>{m.datenschutz_short_body()}</p>
            </Section>

            <Section title={m.datenschutz_hosting_heading()}>
                <p>{m.datenschutz_hosting_body()}</p>
            </Section>

            <Section title={m.datenschutz_localstorage_heading()}>
                <p>{m.datenschutz_localstorage_body()}</p>
            </Section>

            <Section title={m.datenschutz_fonts_heading()}>
                <p>{m.datenschutz_fonts_body()}</p>
            </Section>

            <Section title={m.datenschutz_thirdparty_heading()}>
                <p>{m.datenschutz_thirdparty_body()}</p>
            </Section>

            <Section title={m.datenschutz_analytics_heading()}>
                <p>{m.datenschutz_analytics_body()}</p>
            </Section>

            <Section title={m.datenschutz_email_heading()}>
                <p>{m.datenschutz_email_body()}</p>
            </Section>

            <Section title={m.datenschutz_rights_heading()}>
                <p>{m.datenschutz_rights_body()}</p>
            </Section>
        </main>
    );
}
