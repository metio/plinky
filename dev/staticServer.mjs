// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Serves a built site the way the host does: a path to its file, a directory to its
// index.html, and either a 404 or the SPA shell for anything else. Three gates each
// carried a server of their own with a MIME table of its own, and they had drifted — one
// answered a missing page with 404 while the others fell back to the shell, and each
// table lacked a type another had — so a page could measure differently across gates.

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

export const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".mxl": "application/octet-stream",
    ".musicxml": "application/xml",
    ".webmanifest": "application/manifest+json",
};

// The file under `root` a request path resolves to, or null when there is none: the
// path itself, or its directory's index.html.
export function resolveFile(root, path) {
    const clean = normalize(decodeURIComponent(path.split("?")[0] ?? "/"));
    const inside = join(root, clean);
    if (!inside.startsWith(normalize(root))) {
        return null;
    }
    for (const candidate of [inside, join(inside, "index.html")]) {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
            return candidate;
        }
    }
    return null;
}

// Starts serving `root`. `fallback` is what a missing path gets: "404", or "spa" for the
// shell at root/index.html — with `onFallback(path)` told each time, so a gate can tell a
// page it audited from a shell it audited in its place.
export function serveStatic(root, { fallback = "404", onFallback, port = 0, host } = {}) {
    const server = createServer((request, response) => {
        const path = request.url ?? "/";
        let file = resolveFile(root, path);
        if (file === null && fallback === "spa") {
            onFallback?.(normalize(decodeURIComponent(path.split("?")[0] ?? "/")));
            file = join(root, "index.html");
        }
        if (file === null || !existsSync(file)) {
            response.writeHead(404);
            response.end();
            return;
        }
        response.writeHead(200, {
            "content-type": MIME_TYPES[extname(file)] ?? "application/octet-stream",
        });
        createReadStream(file).pipe(response);
    });
    return new Promise((resolve) => {
        const onListening = () =>
            resolve({
                server,
                port: server.address().port,
                close: () => new Promise((done) => server.close(() => done())),
            });
        if (host) {
            server.listen(port, host, onListening);
        } else {
            server.listen(port, onListening);
        }
    });
}
