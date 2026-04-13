'use client'

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function PWAInstallBanner() {
    const [installEvent, setInstallEvent] = useState<any>(null);
    const [isIOS, setIsIOS] = useState<boolean>(false);
    const [isStandalone, setIsStandalone] = useState<boolean>(false);
    const [showInstructions, setShowInstructions] = useState<boolean>(false);

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
        <>
            {isIOS && (
                 <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
                    <DialogContent className="max-w-[90vw] rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>Instalēšanas pamācība</DialogTitle>
                        </DialogHeader>
                        
                        <div className="space-y-6 py-4">
                            <div className="flex items-start gap-4">
                                <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center shrink-0 font-bold">
                                    1
                                </div>
                                <p className="text-sm">
                                    Pārlūkprogrammas apakšā spied <strong>"Share"</strong> pogu (kvadrāts ar bultiņu).
                                </p>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center shrink-0 font-bold">
                                    2
                                </div>
                                <p className="text-sm">
                                    Ritini sarakstu uz leju un izvēlies <strong>"Add to Home Screen"</strong> vai <strong>"Pievienot sākuma ekrānam"</strong>.
                                </p>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center shrink-0 font-bold">
                                    3
                                </div>
                                <p className="text-sm">
                                    Augšējā stūrī spied <strong>"Add"</strong> vai <strong>"Pievienot"</strong>.
                                </p>
                            </div>
                        </div>

                        <Button 
                            onClick={() => setShowInstructions(false)} 
                            className="w-full"
                        >
                            Sapratu!
                        </Button>
                    </DialogContent>
                </Dialog>
            )}
            <div 
                onClick={() => isIOS && setShowInstructions(true)}
                className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h4 className="text-sm font-bold text-blue-900">Instalēt lietotni</h4>
                        <p className="text-xs text-blue-700 leading-tight">
                            {isIOS 
                            ? "Spied šeit, lai uzzinātu kā pievienot lietotni sākuma ekrānam." 
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
                        <Button variant="outline" size="sm" className="border-blue-200 text-blue-700">
                            Kā?
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
}