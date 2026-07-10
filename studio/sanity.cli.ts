// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { defineCliConfig } from "sanity/cli";

// projectId/dataset come from the environment so no id is hard-coded. Set them in
// .env (see .env.example) or the shell before `sanity deploy`. The hosted Studio
// lives at <studioHost>.sanity.studio — globally unique — from SANITY_STUDIO_HOSTNAME.
export default defineCliConfig({
    api: {
        projectId: process.env.SANITY_STUDIO_PROJECT_ID,
        dataset: process.env.SANITY_STUDIO_DATASET || "production",
    },
    studioHost: process.env.SANITY_STUDIO_HOSTNAME,
});
