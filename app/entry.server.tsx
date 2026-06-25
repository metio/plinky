// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Customised from the React Router default node entry: it resolves the locale
// from the request URL and overwrites getLocale before rendering, so each page
// prerenders in its own language. Prerendering issues one request per
// /<locale>/... path at concurrency 1, so this global overwrite is race-free.

import { PassThrough } from "node:stream";

import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";
import { type EntryContext, type RouterContextProvider, ServerRouter } from "react-router";
import { baseLocale, extractLocaleFromUrl, overwriteGetLocale } from "./paraglide/runtime.js";

export const streamTimeout = 5_000;

export default function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    routerContext: EntryContext,
    _loadContext: RouterContextProvider,
) {
    // The whole render below reads getLocale() (the <html lang>, every m.*()
    // message, every localized link). Pin it to this document's locale.
    overwriteGetLocale(() => extractLocaleFromUrl(request.url) ?? baseLocale);

    // https://httpwg.org/specs/rfc9110.html#HEAD
    if (request.method.toUpperCase() === "HEAD") {
        return new Response(null, {
            status: responseStatusCode,
            headers: responseHeaders,
        });
    }

    return new Promise((resolve, reject) => {
        let shellRendered = false;
        const userAgent = request.headers.get("user-agent");

        // Bots and SPA-mode renders wait for all content before responding.
        const readyOption: keyof RenderToPipeableStreamOptions =
            (userAgent && isbot(userAgent)) || routerContext.isSpaMode
                ? "onAllReady"
                : "onShellReady";

        let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(
            () => abort(),
            streamTimeout + 1000,
        );

        const { pipe, abort } = renderToPipeableStream(
            <ServerRouter context={routerContext} url={request.url} />,
            {
                [readyOption]() {
                    shellRendered = true;
                    const body = new PassThrough({
                        final(callback) {
                            clearTimeout(timeoutId);
                            timeoutId = undefined;
                            callback();
                        },
                    });
                    const stream = createReadableStreamFromReadable(body);

                    responseHeaders.set("Content-Type", "text/html");

                    pipe(body);

                    resolve(
                        new Response(stream, {
                            headers: responseHeaders,
                            status: responseStatusCode,
                        }),
                    );
                },
                onShellError(error: unknown) {
                    reject(error);
                },
                onError(error: unknown) {
                    responseStatusCode = 500;
                    if (shellRendered) {
                        console.error(error);
                    }
                },
            },
        );
    });
}
