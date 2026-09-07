// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Tells the service worker to keep every page of one language on this device. The
// worker does the fetching (see public/sw.js); this is only the message, sent once the
// worker is in charge, since a message to a worker still installing is lost.

export type KeepOfflineContainer = {
    ready: Promise<{ active: { postMessage(message: unknown): void } | null }>;
};

export type KeepOfflineMessage = { type: "KEEP_OFFLINE"; locale: string };

export function keepOfflineAnnouncer(container: KeepOfflineContainer) {
    return async (locale: string): Promise<boolean> => {
        const registration = await container.ready;
        if (!registration.active) {
            return false;
        }
        const message: KeepOfflineMessage = { type: "KEEP_OFFLINE", locale };
        registration.active.postMessage(message);
        return true;
    };
}
