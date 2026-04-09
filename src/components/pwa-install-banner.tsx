'use client'

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share } from 'lucide-react';

export function PWAInstallBanner() {
    const [installEvent, setInstallEvent] = useState<any>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // 1. Detect if already installed (standalone mode)
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsStandalone(true);
        }

        // 2. Detect iOS for manual instructions
        const userAgent = window.navigator.userAgent.toLowerCase();
        setIsIOS(/iphone|ipad|ipod/.test(userAgent));

        // 3. Catch the Chrome/Android install event
        const handler = (e: any) => {
            e.preventDefault(); // Stop automatic popup
            setInstallEvent(e);  // Save for custom button
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!installEvent) return;
        installEvent.prompt();
        const { outcome } = await installEvent.userChoice;
        if (outcome === 'accepted') setInstallEvent(null);
    };

    if (isStandalone) return null; // Don't show if already installed

    return (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <h4 className="text-sm font-bold text-blue-900">Instalēt lietotni</h4>
                    <p className="text-xs text-blue-700 leading-tight">
                        {isIOS 
                          ? "Spied 'Share' un tad 'Add to Home Screen', lai lietotu kā aplikāciju." 
                          : "Pievieno sākuma ekrānam, lai saņemtu paziņojumus un ātru piekļuvi!"}
                    </p>
                </div>

                {/* Show Install button for Android/Chrome */}
                {installEvent && (
                    <Button size="sm" onClick={handleInstallClick} className="bg-blue-600 hover:bg-blue-700 h-9 shrink-0">
                        <Download className="w-4 h-4 mr-2" /> Instalēt
                    </Button>
                )}

                {/* Visual hint for iPhone users (since iOS doesn't support 'beforeinstallprompt') */}
                {isIOS && (
                    <div className="bg-white p-2 rounded-lg border border-blue-200">
                        <Share className="w-5 h-5 text-blue-600" />
                    </div>
                )}
            </div>
        </div>
    );
}