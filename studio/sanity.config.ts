// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./schemaTypes";

// The editing UI Plinky reads from. projectId/dataset come from the environment
// (see .env.example); the app only reads this data over the public API.
export default defineConfig({
    name: "default",
    title: "Plinky",
    projectId: process.env.SANITY_STUDIO_PROJECT_ID || "",
    dataset: process.env.SANITY_STUDIO_DATASET || "production",
    plugins: [structureTool(), visionTool()],
    schema: { types: schemaTypes },
});
