// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { Link, type LinkProps } from "react-router";
import { localizeHref } from "../../paraglide/runtime.js";

// A react-router Link that keeps navigation within the active locale: a string
// `to` (a canonical app path like "/scores" or `/play/${id}`) is rewritten to
// the current locale's prefix. getLocale reads the URL prefix, so links always
// point at the locale the user is already browsing.
export function LocalizedLink({ to, ...rest }: LinkProps) {
    return <Link to={typeof to === "string" ? localizeHref(to) : to} {...rest} />;
}
