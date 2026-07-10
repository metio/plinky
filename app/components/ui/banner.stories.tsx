// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Banner } from "./banner";

const meta: Meta<typeof Banner> = {
    title: "UI/Banner",
    component: Banner,
};
export default meta;

type Story = StoryObj<typeof Banner>;

export const Tones: Story = {
    render: () => (
        <div className="flex flex-col gap-4">
            <Banner tone="amber" role="alert" onDismiss={() => {}} dismissLabel="Dismiss">
                Progress could not be saved on this device.
            </Banner>
            <Banner tone="indigo" onDismiss={() => {}} dismissLabel="Dismiss">
                A new version of the app is ready.
            </Banner>
            <Banner tone="sky" onDismiss={() => {}} dismissLabel="Dismiss">
                Flip the silent switch to hear the piano.
            </Banner>
        </div>
    ),
};

export const WithActions: Story = {
    render: () => (
        <Banner
            tone="indigo"
            onDismiss={() => {}}
            dismissLabel="Dismiss"
            actions={
                <button
                    type="button"
                    className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-500"
                >
                    Reload
                </button>
            }
        >
            A new version of the app is ready.
        </Banner>
    ),
};

export const WithFooter: Story = {
    render: () => (
        <Banner
            tone="indigo"
            onDismiss={() => {}}
            dismissLabel="Dismiss"
            emphasis
            footer={<p className="text-sm text-indigo-900 dark:text-indigo-200">Share the run</p>}
        >
            Grade 3 reached
        </Banner>
    ),
};
