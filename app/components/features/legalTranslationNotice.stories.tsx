// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { LegalTranslationNotice } from "./legalTranslationNotice";

// The story renders under the base locale (en), where the notice is shown; on the
// German page the component renders nothing, so there is nothing to shoot.
const meta: Meta<typeof LegalTranslationNotice> = {
    title: "Features/LegalTranslationNotice",
    component: LegalTranslationNotice,
    args: { page: "datenschutz" },
};
export default meta;

type Story = StoryObj<typeof LegalTranslationNotice>;

export const Default: Story = {};
