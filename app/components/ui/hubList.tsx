// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { Folio, FolioRow, folioIconClasses } from "./folio";

export type HubEntry = {
    to: string;
    label: string;
    blurb: string;
    Icon: (props: { className?: string }) => ReactNode;
};

// A list of destinations, each with room to say what it actually is. The two hubs
// use it — Learn for the whole schoolroom, Teach for the making and the reading of sets —
// so a place that gathers things looks the same wherever you meet it. Each entry is a
// Folio row that is one link, icon and all.
//
// Silent: only a key that is pressed makes a note in Plinky, never a pointer passing over.
export function HubList({ entries }: { entries: HubEntry[] }) {
    return (
        <Folio>
            {entries.map((entry) => (
                <FolioRow
                    key={entry.to}
                    to={entry.to}
                    margin={<entry.Icon className={folioIconClasses} />}
                    name={`${entry.label} →`}
                    line={entry.blurb}
                />
            ))}
        </Folio>
    );
}
