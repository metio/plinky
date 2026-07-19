// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { noindexMeta, routeMeta } from "../../core/site";
import type { Route } from "./+types/impressum";

// The provider identification German law requires (§ 5 DDG). The content is a
// legal document in German — the operator's jurisdiction language — so it stays
// as literal text rather than flowing through paraglide. It is reachable from the
// footer of every page, as "leicht erkennbar, unmittelbar erreichbar, ständig
// verfügbar" demands. NOTE: verify the wording against a current generator or a
// lawyer before relying on it, especially once ads or analytics go live.
export function meta(_args: Route.MetaArgs) {
    // A legal notice has no place in search results; it stays reachable from every
    // footer, so noindex it (and it is left out of the sitemap).
    return [
        ...routeMeta("Impressum", "Anbieterkennzeichnung von Plinky nach § 5 DDG."),
        noindexMeta(),
    ];
}

export default function Impressum() {
    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <h1 className="text-2xl font-semibold">Impressum</h1>

            <section className="space-y-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Angaben gemäß § 5 DDG
                </h2>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    Sebastian Hoß
                    <br />
                    Bremer Platz 7
                    <br />
                    48155 Münster
                    <br />
                    Deutschland
                </p>
            </section>

            <section className="space-y-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Kontakt
                </h2>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    E-Mail:{" "}
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
                    Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
                </h2>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    Sebastian Hoß (Anschrift wie oben)
                </p>
            </section>
        </main>
    );
}
