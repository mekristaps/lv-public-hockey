import { useState, useEffect } from "react";

interface FullScreenLoaderProps {
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

export function FullScreenLoader({ message }: FullScreenLoaderProps){
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
        <div className="min-w-[100vw] absolute top-0 left-0 z-99 flex h-screen flex-col items-center justify-center gap-4 bg-slate-50">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <div className="text-lg font-bold text-slate-700 animate-pulse">
                {displayPhrase}
            </div>
        </div>
    );
};