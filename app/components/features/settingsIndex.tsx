// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { m } from "../../paraglide/messages.js";
import { sectionLabelClasses } from "../ui/classes";

export type SettingsIndexGroup = {
    label: string;
    items: readonly { anchor: string; title: string }[];
};

// The settings page as a list you can jump around in, beside the page itself — the same
// index the theory course and the glossary put down their side, so a reader learns the
// shape once. Anchors rather than state: every section already carries an id, because
// the front page sends people straight at the three they get stuck on.
//
// The groups are what somebody came here to change — the instrument they play on, how
// the music reads while they play, what counts as learned, the device itself — rather
// than which part of the app owns a setting, and they are the page's own order.
export function SettingsIndex({
    groups,
    current,
}: {
    groups: readonly SettingsIndexGroup[];
    // The anchor the address names, if any: the one section the reader was sent to.
    current: string;
}) {
    return (
        <nav aria-label={m.settings_index_label()} className="space-y-5 md:sticky md:top-24 md:self-start">
            {groups.map((group) => (
                <div key={group.label} className="space-y-1">
                    <p className={sectionLabelClasses}>{group.label}</p>
                    <ul aria-label={group.label}>
                        {group.items.map((item) => {
                            const here = item.anchor === current;
                            return (
                                <li key={item.anchor}>
                                    <a
                                        href={`#${item.anchor}`}
                                        aria-current={here ? "location" : undefined}
                                        className={`block rounded-md px-2 py-1 text-sm hover:bg-subtle hover:text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring ${
                                            here
                                                ? "bg-accent-surface font-medium text-accent"
                                                : "text-muted"
                                        }`}
                                    >
                                        {item.title}
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );
}
