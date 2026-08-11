// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { withTrailingSlash } from "../../../core/site";
import { localizeHref } from "../../paraglide/runtime.js";

// The one place an in-app URL is built. paraglide prefixes the active locale (or the
// one named in `options`), and the trailing slash matches the prerendered
// `<path>/index.html` the host serves, so a link resolves in one hop and every URL a
// crawler meets is already the canonical one. It lives in ui/ because that is the only
// layer every caller can reach — the ui-is-pure rule keeps these components out of
// lib/, and core/ cannot see paraglide. dev/check-globals.mjs confines localizeHref to
// this file, so a new link cannot quietly skip the slash.
export function localizedHref(to: string, options?: Parameters<typeof localizeHref>[1]): string {
    return withTrailingSlash(localizeHref(to, options));
}
