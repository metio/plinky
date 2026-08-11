// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { localizedHref } from "../ui/href";

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
            className="rounded-lg border border-warn-line bg-warn-surface p-4 text-sm leading-relaxed text-warn-ink dark:border-warn-line/60 dark:bg-warn-surface/40"
        >
            <p>{m.legal_mt_notice_body()}</p>
            <p className="mt-2">
                <a
                    href={localizedHref(`/${page}`, { locale: "de" })}
                    className="font-medium underline hover:no-underline"
                >
                    {m.legal_mt_view_original()}
                </a>
            </p>
        </aside>
    );
}
