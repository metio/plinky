// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A duration in milliseconds as a figure of seconds to one decimal place, written the way
// the locale writes numbers: "1.4" in English, "1,4" in German. The unit is left to the
// message around it, which knows where its language puts the symbol. Thousands are never
// grouped: German groups them with a full stop, and "1.000,0s" reads as a second.
export function secondsFigure(ms: number, locale: string): string {
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        useGrouping: false,
    }).format(ms / 1000);
}
