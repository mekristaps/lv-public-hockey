'use client'

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Lock, ChevronDown } from "lucide-react";
import { sendNewPin } from "@/lib/actions/admin";

interface PinRequestsProps { 
    initialRequests: any[] | null;
}

export function PinRequests({ initialRequests }: PinRequestsProps) {
    const [requests, setRequests] = useState(initialRequests || []);

    if (requests.length === 0) return null;

    const handleSendPin = async (requestID: string) => {

        try {
            const response = await sendNewPin(requestID);
            if (response.success) {
                window.location.href = response.link;
            } else {
               console.error("Failed to send pin:", response?.error);
            }
        } catch (error) {

        } finally {

        }
    };

    return (
        <div className="w-full max-w-md border border-emerald-200 rounded-xl bg-emerald-50/30 overflow-hidden">
            <details className="group">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 bg-emerald-100 rounded-full">
                            <Lock className="w-3.5 h-3.5 text-emerald-600" />
                        </span>
                        <span className="text-sm font-bold text-emerald-900 uppercase tracking-tight">
                            PIN Pieprasījumi
                        </span>
                        <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                            {requests.length}
                        </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-emerald-600 transition-transform group-open:rotate-180" />
                </summary>

                <div className="px-2 pb-2">
                    <div className="bg-white rounded-lg border border-emerald-100 divide-y divide-emerald-50">
                        {requests.map((request) => {
                            
                            const createdDate = new Date(request.created_at);
                            const nowMs = Date.now(); 
                            const createdMs = createdDate.getTime();
                            const diffInMs = nowMs - createdMs;
                            const diffInMins = Math.floor(diffInMs / 60000);

                            const timeAgo = diffInMins < 1 ? 
                                "tikko" 
                                : 
                                diffInMins < 60 ? 
                                    `pirms ${diffInMins} min` 
                                    : 
                                    `pirms ${Math.floor(diffInMins / 60)} h`;

                            return (
                                <div key={request.id} className="p-3 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-800">
                                            {request.full_name}
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                            {request.phone_number} • {timeAgo}
                                        </span>
                                    </div>
                                    <Button 
                                        onClick={() => handleSendPin(request.id)}
                                        size="sm"
                                        variant="ghost" 
                                        className="h-8 text-emerald-600 border border-emerald-600 hover:bg-emerald-600 hover:text-white text-[11px] font-bold uppercase"
                                    >
                                        Sūtīt PIN
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </details>
        </div>
    )
}