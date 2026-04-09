'use client'

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

export default function InstallButton() {
	const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
	const [isInstalled, setIsInstalled] = useState<boolean>(false);
    const [isHidden, setIsHidden] = useState<boolean>(false);

	useEffect(() => {
        // 1. Create a safe reference to the global object
        const gt = globalThis as any;

        console.log('Window object:', gt.window);
        console.log('Window object:', window);

        // 2. Check for standalone mode (PWA already installed)
        const isStandalone = 
            gt.navigator?.standalone || 
            gt.window?.matchMedia?.("(display-mode: standalone)")?.matches;

        if (isStandalone) {
            setIsInstalled(true);
        }

        // 3. Setup the install prompt listener
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        if (gt.window) {
            gt.window.addEventListener("beforeinstallprompt", handler);
        }

        return () => {
            if (gt.window) {
                gt.window.removeEventListener("beforeinstallprompt", handler);
            }
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            return;
        }

        // show browser install prompt
        deferredPrompt.prompt();

        // wait for user to respond to prompt
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    // dont show anything if already installed or prompt not available
    if (isInstalled || !deferredPrompt) {
        return null;
    }

	return (
        <div className="fixed bottom-0 left-4 right-4 z-50">
            <button
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-2xl shadow-2xl font-bold text-lg active:scale-95 transition-transform"
            >
                <Download className="w-6 h-6" />
                Instalēt kā lietotni
            </button>
            <button 
                onClick={() => setIsHidden(true)}
                className="absolute bottom-12 right-4 z-50 flex items-center justify-center bg-white w-10 h-10 rounded cursor-pointer border-green-500"
            >
                <X className="w-6 h-6" />
            </button>
        </div>
    );
}
