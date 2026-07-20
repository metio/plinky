// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";
import { getLocale, localizeHref } from "../../paraglide/runtime.js";

// The legal pages are authored in German, the operator's binding language. Every
// other locale renders a machine translation, so it carries this notice: German
// prevails, the translation is a convenience, and the original is one click away.
// On the German page itself there is nothing to disclaim, so it renders nothing.
export function LegalTranslationNotice({ page }: { page: "impressum" | "datenschutz" }) {
    if (getLocale() === "de") {
        return null;
    }
    return (
        <aside
            role="note"
            className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
            <p>{m.legal_mt_notice_body()}</p>
            <p className="mt-2">
                <a
                    href={localizeHref(`/${page}`, { locale: "de" })}
                    className="font-medium underline hover:no-underline"
                >
                    {m.legal_mt_view_original()}
                </a>
            </p>
        </aside>
    );
}
