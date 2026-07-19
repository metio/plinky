// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ReactNode } from "react";
import { routeMeta } from "../../core/site";
import type { Route } from "./+types/datenschutz";

// The privacy policy German/EU law requires (GDPR / DSGVO). Like the Impressum
// it is a legal document in German and stays as literal text. It describes what
// Plinky ACTUALLY does today: a client-only app that keeps its data in the
// browser, hosted static files, and one third-party content fetch for the news
// banner — no accounts, no cookies, no tracking, no ads. NOTE: this is a
// grounded DRAFT, not vetted legal wording — verify it against a current
// generator (e.g. eRecht24) or a lawyer, and UPDATE it before enabling analytics
// or ads (those add cookie consent, Consent Mode, and new processing to disclose).
export function meta(_args: Route.MetaArgs) {
    return routeMeta("Datenschutzerklärung", "Wie Plinky mit deinen Daten umgeht.");
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
            <h1 className="text-2xl font-semibold">Datenschutzerklärung</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Stand: Juli 2026</p>

            <Section title="Verantwortlicher">
                <p>
                    Verantwortlich für die Datenverarbeitung auf dieser Website ist:
                    <br />
                    Sebastian Hoß, Bremer Platz 7, 48155 Münster, Deutschland
                    <br />
                    E-Mail:{" "}
                    <a
                        href="mailto:contact@plinky.fun"
                        className="text-indigo-700 hover:underline dark:text-indigo-300"
                    >
                        contact@plinky.fun
                    </a>
                </p>
            </Section>

            <Section title="Kurz gefasst">
                <p>
                    Plinky ist eine reine Browser-Anwendung. Deine Einstellungen, dein Fortschritt
                    und deine Aufnahmen werden ausschließlich lokal in deinem Browser gespeichert
                    und von uns nicht erhoben oder an einen Server übertragen. Es gibt keine
                    Benutzerkonten, keine Cookies zu Analyse- oder Werbezwecken, kein Tracking und
                    keine Werbung.
                </p>
            </Section>

            <Section title="Hosting und Server-Logfiles">
                <p>
                    Die Website wird als statische Dateien über GitHub Pages (GitHub, Inc., USA)
                    ausgeliefert. Beim Abruf verarbeitet der Hoster technisch notwendige Daten wie
                    deine IP-Adresse, Datum und Uhrzeit des Zugriffs sowie die übertragene
                    Datenmenge, um die Seite auszuliefern und den Betrieb sicher zu halten.
                    Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren und stabilen
                    Bereitstellung (Art. 6 Abs. 1 lit. f DSGVO). Eine Übermittlung in die USA stützt
                    sich auf die Zertifizierung des Anbieters nach dem EU-US Data Privacy Framework.
                </p>
            </Section>

            <Section title="Lokale Speicherung im Browser">
                <p>
                    Für den Betrieb der App nutzen wir den lokalen Speicher deines Browsers
                    (Local Storage) — etwa für deine Einstellungen, deinen Übungsfortschritt und
                    gespeicherte Aufnahmen. Diese Daten verbleiben auf deinem Gerät, werden nicht an
                    uns übertragen und lassen sich jederzeit über die Einstellungen oder deinen
                    Browser löschen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
                    (funktionsfähige, komfortable Bereitstellung der App).
                </p>
            </Section>

            <Section title="Schriftarten">
                <p>
                    Schriftarten werden von unserem eigenen Server geladen. Es werden keine externen
                    Dienste wie Google Fonts eingebunden, sodass hierbei keine Daten an Dritte
                    übermittelt werden.
                </p>
            </Section>

            <Section title="Inhalte von Drittanbietern (Neuigkeiten-Banner)">
                <p>
                    Auf der Startseite kann ein Hinweis-Banner mit aktuellen Neuigkeiten erscheinen.
                    Dessen Inhalte werden bei Aufruf vom Content-Dienst Sanity (Sanity.io, Dänemark,
                    EU) geladen. Dabei wird deine IP-Adresse technisch bedingt an den Anbieter
                    übermittelt, um die Inhalte auszuliefern. Rechtsgrundlage ist Art. 6 Abs. 1 lit.
                    f DSGVO. Schlägt der Abruf fehl, funktioniert die App unverändert weiter.
                </p>
            </Section>

            <Section title="Kontaktaufnahme per E-Mail">
                <p>
                    Wenn du uns per E-Mail schreibst, verarbeiten wir deine Angaben ausschließlich
                    zur Bearbeitung deiner Anfrage (Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO).
                </p>
            </Section>

            <Section title="Deine Rechte">
                <p>
                    Dir stehen gegenüber uns die folgenden Rechte hinsichtlich deiner
                    personenbezogenen Daten zu: Auskunft, Berichtigung, Löschung, Einschränkung der
                    Verarbeitung, Widerspruch gegen die Verarbeitung sowie Datenübertragbarkeit. Du
                    hast zudem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
                    Wende dich für die Ausübung deiner Rechte an die oben genannte Kontaktadresse.
                </p>
            </Section>
        </main>
    );
}
