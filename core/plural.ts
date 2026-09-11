// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A counted message outside paraglide's runtime — the edge writes piece pages from the
// catalogue's messages without it — choosing its form the way the runtime does.

// A message's forms keyed by the CLDR plural category each is written for ("one", "few",
// "other", …). Every counted message carries "other".
export type PluralForms = Readonly<Record<string, string>>;

// The locale whose plural rules a language counts by. Portuguese is written here in its
// European form, where zero takes the plural; the bare "pt" tag resolves to the Brazilian
// rules, which put zero with one. dev/compile-messages.mjs points paraglide at the same
// rules.
export function pluralRulesLocale(locale: string): string {
    return locale === "pt" ? "pt-PT" : locale;
}

// The form a count reads in: its own category's, else "other".
export function pickPlural(forms: PluralForms, locale: string, count: number): string {
    const category = new Intl.PluralRules(pluralRulesLocale(locale)).select(count);
    return forms[category] ?? forms.other ?? "";
}

// The forms of one catalogue entry as messages/*.json holds it: a plain string reads the
// same for every count, and a paraglide plural entry selecting on a single input yields
// its arms. Null for anything else — an entry selecting on two inputs has no one count to
// choose by, and one without "other" has nothing to fall back to.
export function pluralForms(entry: unknown): PluralForms | null {
    if (typeof entry === "string") {
        return entry === "" ? null : { other: entry };
    }
    if (!Array.isArray(entry) || entry.length !== 1) {
        return null;
    }
    const [variant] = entry as unknown[];
    if (typeof variant !== "object" || variant === null) {
        return null;
    }
    const { selectors, match } = variant as { selectors?: unknown; match?: unknown };
    if (
        !Array.isArray(selectors) ||
        selectors.length !== 1 ||
        typeof match !== "object" ||
        match === null
    ) {
        return null;
    }
    const prefix = `${String(selectors[0])}=`;
    const forms: Record<string, string> = {};
    for (const [key, text] of Object.entries(match)) {
        if (!key.startsWith(prefix) || typeof text !== "string") {
            return null;
        }
        forms[key.slice(prefix.length)] = text;
    }
    return typeof forms.other === "string" ? forms : null;
}
