// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type React from "react";
import { Link, useLocation, useNavigate } from "react-router";
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

// Below this scroll offset the front page counts as sitting at the top, so help opens
// at its own top — the getting-started intro — rather than skipping straight past it.
const AT_TOP_PX = 8;

// The header help control: a question-mark icon that opens the help page scrolled
// to the section for the current page. Replaces the theme toggle in the header —
// the theme is still changeable in Settings.
export function HelpLink() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const anchor = helpAnchorFor(pathname);

    // From the top of the front page, open help at its own top so the getting-started
    // intro isn't skipped; once the reader has scrolled down into the page they were
    // reading about, jump to that page's section instead. The Link's href keeps the
    // section anchor so hover, right-click and open-in-new-tab still show the section.
    const onClick = (event: React.MouseEvent) => {
        if (anchor === "home" && window.scrollY <= AT_TOP_PX) {
            event.preventDefault();
            navigate(localizeHref("/help"));
        }
    };

    return (
        <Link
            to={`${localizeHref("/help")}#${anchor}`}
            onClick={onClick}
            aria-label={m.nav_help()}
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
            <QuestionIcon className="h-5 w-5" />
        </Link>
    );
}
