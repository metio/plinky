// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { attributionFor } from "../../core/attribution";
import { m } from "../paraglide/messages.js";

// A subtle provenance line for a catalogue piece: its licence (linking to the
// deed) and where it came from (linking to the source). Renders nothing when a
// piece carries neither — a bundled demo or a generated exercise — so it never
// shows an empty row.
export function Attribution({
    composer,
    license,
    source,
}: {
    composer?: string;
    license?: string;
    source?: string;
}) {
    const { license: licenseDetail, source: sourceDetail } = attributionFor({
        composer,
        license,
        source,
    });
    if (!licenseDetail && !sourceDetail) {
        return null;
    }

    const link = "text-indigo-700 underline dark:text-indigo-300";
    return (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-500">
            {licenseDetail && (
                <a href={licenseDetail.url} target="_blank" rel="noreferrer" className={link}>
                    {licenseDetail.publicDomain
                        ? `${m.attribution_public_domain()} (${licenseDetail.label})`
                        : licenseDetail.label}
                </a>
            )}
            {sourceDetail && (
                <span>
                    {m.attribution_via()}{" "}
                    <a href={sourceDetail.url} target="_blank" rel="noreferrer" className={link}>
                        {sourceDetail.label}
                    </a>
                    {sourceDetail.credit
                        ? ` (${m.attribution_edited_by()} ${sourceDetail.credit})`
                        : ""}
                </span>
            )}
        </p>
    );
}
