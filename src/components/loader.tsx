import { useState, useEffect } from "react";

interface LoaderProps {
    message?: string;
}

const loadingPhrases = [
    "Salst ledus... ❄️",
    "Tīra ledu... 🏒",
    "Meklējam ripas... 🔍",
    "Sienam slidas... ⛸️",
    "Gatavojam vārtus... 🥅",
    "Asinām slidas... ✨",
];

export const Loader = ({ message }: LoaderProps) => {
    const [displayPhrase, setDisplayPhrase] = useState("");

    useEffect(() => {
        if (message) {
            setDisplayPhrase(message);
        } else {
            const randomIdx = Math.floor(Math.random() * loadingPhrases.length);
            setDisplayPhrase(loadingPhrases[randomIdx]);
        }
    }, [message]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="flex aspect-square w-64 flex-col items-center justify-center gap-6 rounded-3xl bg-white p-8 shadow-2xl border border-slate-100">
                <div className="relative flex items-center justify-center">
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <div className="absolute h-8 w-8 animate-pulse rounded-full bg-slate-100 flex items-center justify-center">
                         <div className="w-4 h-1 bg-slate-400 rounded-full" />
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-1">
                        Lūdzu, uzgaidiet
                    </p>
                    <div className="text-lg font-bold text-slate-800 transition-all">
                        {displayPhrase}
                    </div>
                </div>
            </div>
        </div>
    );
};