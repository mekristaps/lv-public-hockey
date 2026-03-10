// force immediate activation
self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(clients.claim());
});

// handle Push Notification
self.addEventListener("push", (event) => {
    if (!event.data) return;

    // 1. Set default values
    let notificationTitle = "Hokeja Atgādinājums";
    let notificationOptions = {
        body: "Jums ir jauna ziņa!",
        icon: "/icon-192x192.png",
        badge: "/icon-192x192.png",
        data: { url: "/" },
    };

    try {
        // 2. Try to parse as JSON (for your real Supabase Edge Function)
        const data = event.data.json();
        notificationTitle = data.title || notificationTitle;
        notificationOptions.body = data.body || notificationOptions.body;
        notificationOptions.data.url = data.url || "/";
    } catch (e) {
        // 3. Fallback to Plain Text (for DevTools "Test" button or manual pushes)
        notificationOptions.body = event.data.text();
    }

    // 4. Show the notification
    event.waitUntil(
        self.registration.showNotification(notificationTitle, notificationOptions)
    );
});

// handle clicking notification
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data.url || "/";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
            // If a tab is already open, focus it
            for (let client of windowClients) {
                if (client.url === urlToOpen && "focus" in client) {
                    return client.focus();
                }
            }
            // Otherwise, open a new tab
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});