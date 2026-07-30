// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMemo } from "react";
import { symbolsInScore } from "../../../core/scoreSymbols";
import { symbolGloss, symbolName } from "../../lib/glossaryLabels";
import { m } from "../../paraglide/messages.js";
import { linkClasses } from "../ui/classes";
import { BookIcon } from "../ui/icons";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { SettingsSection } from "../ui/settingsSection";

// The marks this piece asks you to read, each one a way into the glossary.
//
// A reference nobody knows to open teaches nobody: a reader who meets a curve over two
// notes cannot look up "slur", because not knowing the word is the problem. Naming what
// is in front of them, where they are about to play it, is the way in — so this sits in
// the panel they open before a run, beside the reading aids.
//
// Nothing shows when a piece has nothing unusual in it. A beginner tune that is all
// plain quarter notes should not sprout an empty "notation" heading promising something
// to learn.
export function ScoreSymbols({ xml }: { xml: string }) {
    // Scanning the whole piece for a dozen marks is cheap, but it happens on every
    // render of a panel that re-renders whenever any reading aid moves.
    const symbols = useMemo(() => symbolsInScore(xml), [xml]);

    if (symbols.length === 0) {
        return null;
    }

    return (
        <SettingsSection
            title={m.score_symbols_title()}
            hint={m.score_symbols_subtitle()}
            icon={<BookIcon className="h-5 w-5" />}
        >
            <ul className="space-y-1">
                {symbols.map((symbol) => (
                    <li key={symbol.id} className="text-sm">
                        <Link
                            // Opens the glossary on this symbol rather than at the top,
                            // so the answer is the first thing on screen.
                            to={`/glossary/?symbol=${symbol.id}`}
                            className={linkClasses}
                        >
                            {symbolName(symbol.id)}
                        </Link>
                        <span className="text-gray-600 dark:text-gray-400">
                            {" — "}
                            {symbolGloss(symbol.id)}
                        </span>
                    </li>
                ))}
            </ul>
        </SettingsSection>
    );
}
