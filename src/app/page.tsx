import { getPinRequests } from "@/lib/actions/admin";

import { UserPanel } from "@/components/user-panel";
import { ScheduleSection } from "@/components/schedule-section";
import { PWAInstallBanner } from "@/components/pwa-install-banner";
import { PinRequests } from "@/components/pin-requests";

export default async function HockeyDashboard() {
    const pinRequests = await getPinRequests();

    return (
        <div className="max-w-md mx-auto p-4 space-y-6 pb-20">
            {/* PWA Install banner */}
            <PWAInstallBanner />

            {/* Pin Reset List */}
            <PinRequests initialRequests={pinRequests?.data ?? []} />

            {/* Profile Section */}
            <UserPanel />
            
            {/* Schedule Section */}
            <ScheduleSection />
        </div>
    );
}
