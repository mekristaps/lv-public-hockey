export async function subscribeUserToPush() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!publicKey) {
        console.error("VAPID Public Key is missing from env");
		return;
	}

    const gt = globalThis as any;
    if (!gt.window || !('serviceWorker' in gt.navigator)) {
        return;
    }
    console.log('subscribeUserToPush');
    const registration = await gt.navigator.serviceWorker.ready;
    console.log('registration: ', registration);
    // check if they already have a subscription
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
        return existingSubscription;
    }

    // if not - subscribe them
    const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
    };

    return await registration.pushManager.subscribe(subscribeOptions);
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = globalThis.window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}