"use client";

import { useState, useEffect, useActionState, useMemo, Fragment } from "react";

import { createClient } from "@/lib/supabase/client";
import { getUserProfile, getSchedule } from "@/lib/supabase/queries";
import { profileAction, requestPinHelpAction, registerAction, updateGuestsAction } from "@/lib/actions/profiles";

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    CheckCircle2,
    CalendarDays,
    Phone,
    Lock,
    XCircle,
    PlusCircle,
    MinusCircle,
    UserPlus
} from "lucide-react";

import InstallButton from "@/components/InstallButton";
import { FullScreenLoader } from "@/components/full-screen-loader";
import { useUser } from "@/context/UserContext";
import { UserPanel } from "@/components/user-panel";
import { ScheduleSection } from "@/components/schedule-section";

interface FormFields {
    phone: string;
    full_name: string;
}

interface UserProfile {
    created_at: string;
    id: string;
    phone_number: string;
    pin_code: string;
    full_name: string;
    is_admin: boolean;
    registrations: any[];
}

interface HockeySession {
    id: string;
    arena_name: string;
    start_time: string;
}

// check if ios
const isIOS = /iPad|iPhone|iPod/.test(globalThis.navigator?.userAgent) && !(globalThis as any).navigator?.standalone;

export default function HockeyDashboard() {
    const { profile } = useUser();

    return (
        <div className="max-w-md mx-auto p-4 space-y-6 pb-20">
            {/* Loading Overlay */}
            {isIOS ? (
                <div className="bg-slate-800 text-white p-4 rounded-lg text-sm mb-4">
                    <p>Lai instalētu šo lietotni iPhone:</p>
                    <ol className="list-decimal ml-5 mt-2">
                        <li>Nospiediet "Share" pogu (kvadrāts ar bultiņu)</li>
                        <li>Ritiniet uz leju un izvēlieties "Add to Home Screen"</li>
                    </ol>
                </div>
            ) : <InstallButton />}
            {/* Profile Section */}
            <UserPanel profile={profile} />
            
            {/* Schedule Section */}
            <ScheduleSection profile={profile} />

            {/* Fixed bottom nav placeholder */}
            {/* <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-3 flex justify-around text-muted-foreground">
				<Trophy className="w-6 h-6 text-primary" />
				<Users className="w-6 h-6" />
			</div> */}
        </div>
    );
}
