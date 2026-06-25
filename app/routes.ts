// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("play/:songId", "routes/play.tsx"),
    route("sprint", "routes/sprint.tsx"),
    route("daily", "routes/daily.tsx"),
    route("ear", "routes/ear.tsx"),
    route("songs", "routes/songs.tsx"),
    route("curriculums", "routes/curriculums.tsx"),
    route("tracks", "routes/tracks.tsx"),
    route("progress", "routes/progress.tsx"),
    route("import", "routes/import.tsx"),
    route("settings", "routes/settings.tsx"),
] satisfies RouteConfig;
