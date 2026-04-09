'use client'

import { useState, useEffect } from "react";
import { subscribeUserToPush } from "@/utils/push";

import { Bell, BellOff, Loader2 } from "lucide-react";

interface NotificationsProps {
    phoneNumber: string;
}

export default function Notifications({ phoneNumber }: NotificationsProps) {
    const [isEnabled, setIsEnabled] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        async function checkStatus() {
            if (typeof window !== "undefined" && "serviceWorker" in navigator) {
                try {
                    // Register the static file from /public/sw.js
                    const reg = await navigator.serviceWorker.register("/sw.js");
                    const sub = await reg.pushManager.getSubscription();
                    setIsEnabled(!!sub);
                } catch (error) {
                    console.error("Service Worker check failed:", error);
                }
            }
        }
        checkStatus();
    }, []);

    const toggleNotifications = async () => {
        setLoading(true);
        try {
            if (isEnabled) {
                await handleUnsubscribe();
            } else {
                await handleSubscribe();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async () => {
        // Safe access to localStorage

        if (!phoneNumber) {
            alert("Lūdzu, vispirms saglabājiet savu profilu!");
            return;
        }

        const subscription = await subscribeUserToPush();
        if (!subscription) return;

        const res = await fetch("/api/push/subscribe", {
            method: "POST",
            body: JSON.stringify({ subscription, phoneNumber }),
            headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
            setIsEnabled(true);
        }
    };

    const handleUnsubscribe = async () => {
        if (!("serviceWorker" in navigator)) return;
        
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        
        if (sub) {
            await sub.unsubscribe();
            await fetch("/api/push/unsubscribe", {
                method: "POST",
                body: JSON.stringify({ endpoint: sub.endpoint }),
                headers: { "Content-Type": "application/json" },
            });
        }
        setIsEnabled(false);
    };

    return (
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                        {isEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900">Paziņojumi</h3>
                        <p className="text-xs text-slate-500">Saņemt ziņas par spēlēm</p>
                    </div>
                </div>

                <button
                    onClick={toggleNotifications}
                    disabled={loading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        isEnabled ? "bg-blue-600" : "bg-slate-300"
                    }`}
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto text-white" />
                    ) : (
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                isEnabled ? "translate-x-6" : "translate-x-1"
                            }`}
                        />
                    )}
                </button>
            </div>
        </div>
    );
}