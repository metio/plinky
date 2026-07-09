// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { Link, useLocation } from "react-router";
import { QuestionIcon } from "../ui/icons";
import { m } from "../../paraglide/messages.js";
import { localizeHref } from "../../paraglide/runtime.js";

// Maps the current path to a help section key so the header ? lands the reader on
// the help for the page they're on. The pathname carries the /:locale prefix, so
// the language segment is stripped before matching. An unrecognised path falls back
// to the getting-started section, which is also the top of the page.
export function helpAnchorFor(pathname: string): string {
    const rest = pathname.replace(/^\/[^/]+/, "");
    if (rest.startsWith("/play")) return "play";
    if (rest.startsWith("/compose")) return "compose";
    if (rest.startsWith("/daily")) return "daily";
    if (rest.startsWith("/library")) return "library";
    if (rest.startsWith("/assignments")) return "assignments";
    if (rest.startsWith("/you")) return "you";
    if (rest.startsWith("/review")) return "review";
    if (rest.startsWith("/settings")) return "settings";
    if (rest === "" || rest === "/") return "home";
    return "gettingStarted";
}

// The header help control: a question-mark icon that opens the help page scrolled
// to the section for the current page. Replaces the theme toggle in the header —
// the theme is still changeable in Settings.
export function HelpLink() {
    const { pathname } = useLocation();
    const anchor = helpAnchorFor(pathname);
    return (
        <Link
            to={`${localizeHref("/help")}#${anchor}`}
            aria-label={m.nav_help()}
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
            <QuestionIcon className="h-5 w-5" />
        </Link>
    );
}
