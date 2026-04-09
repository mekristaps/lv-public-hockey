"use client";

import InstallButton from "@/components/InstallButton";
import { useUser } from "@/context/UserContext";
import { UserPanel } from "@/components/user-panel";
import { ScheduleSection } from "@/components/schedule-section";
import { PWAInstallBanner } from "@/components/pwa-install-banner";

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
            ) : 
                (
                    <>
                    <PWAInstallBanner />
                    {/* <InstallButton /> */}
                    </>
                )
            }
            {/* Profile Section */}
            <UserPanel profile={profile} />
            
            {/* Schedule Section */}
            <ScheduleSection profile={profile} />
        </div>
    );
}
