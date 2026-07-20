// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { noindexMeta, routeMeta } from "../../core/site";
import { LegalTranslationNotice } from "../components/features/legalTranslationNotice";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/impressum";

// The provider identification German law requires (§ 5 DDG). The authoritative
// document is German — the operator's jurisdiction language; the German version
// alone is legally binding. Every other locale renders a machine translation
// carrying LegalTranslationNotice. It is reachable from the footer of every page,
// as "leicht erkennbar, unmittelbar erreichbar, ständig verfügbar" demands. NOTE:
// verify the German wording against a current generator or a lawyer before relying
// on it, especially once ads or analytics go live; the translations follow it.
export function meta(_args: Route.MetaArgs) {
    // A legal notice has no place in search results; it stays reachable from every
    // footer, so noindex it (and it is left out of the sitemap). Its translations
    // inherit the same noindex.
    return [
        ...routeMeta("Impressum", "Anbieterkennzeichnung von Plinky nach § 5 DDG."),
        noindexMeta(),
    ];
}

export default function Impressum() {
    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <h1 className="text-2xl font-semibold">Impressum</h1>

            <LegalTranslationNotice page="impressum" />

            <section className="space-y-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {m.impressum_provider_heading()}
                </h2>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    Sebastian Hoß
                    <br />
                    Bremer Platz 7
                    <br />
                    48155 Münster
                    <br />
                    {m.legal_country()}
                </p>
            </section>

            <section className="space-y-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {m.impressum_contact_heading()}
                </h2>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    {m.contact_email_label()}{" "}
                    <a
                        href="mailto:contact@plinky.fun"
                        className="text-indigo-700 hover:underline dark:text-indigo-300"
                    >
                        contact@plinky.fun
                    </a>
                </p>
            </section>

            <section className="space-y-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {m.impressum_responsible_heading()}
                </h2>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    {m.impressum_responsible_body()}
                </p>
            </section>
        </main>
    );
}
