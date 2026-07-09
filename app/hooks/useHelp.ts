// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import type { HelpItem } from "../../core/help";
import { useHelpSource } from "../contexts/services";

export type HelpState = { loading: boolean; items: HelpItem[] };

// Fetch every help item for the given language, re-fetching when the language
// changes. Starts loading; resolves to the items, or to an empty list on any
// failure so the page falls back to its app-defined section skeleton instead of
// breaking. Client-only, like the news source — the source is untouched during
// prerender, keeping the static shell stable.
export function useHelp(lang: string): HelpState {
    const source = useHelpSource();
    const [state, setState] = useState<HelpState>({ loading: true, items: [] });
    useEffect(() => {
        let live = true;
        setState({ loading: true, items: [] });
        source.fetchItems(lang).then(
            (items) => {
                if (live) {
                    setState({ loading: false, items });
                }
            },
            () => {
                if (live) {
                    setState({ loading: false, items: [] });
                }
            },
        );
        return () => {
            live = false;
        };
    }, [source, lang]);
    return state;
}
