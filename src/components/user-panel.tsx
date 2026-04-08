'use client'

import { UserProfile } from '@/lib/actions/profiles';

import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

import Notifications from "@/components/Notifications";
import { UserForm } from "@/components/user-form";

interface UserPanelProps {
    profile: UserProfile | null;
}
export function UserPanel({ profile }: UserPanelProps) {

    return (
        <section className="overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm transition-all">
            {/* Profile Header Area */}
            {profile ? (
                <div className="bg-slate-50/50 px-5 pt-5 pb-1 border-b border-slate-100">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            {/* Visual Avatar Placeholder */}
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                                {profile.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 leading-none mb-1">
                                    {profile.full_name}
                                </h2>
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    {profile.phone_number}
                                </p>
                            </div>
                        </div>

                        {profile?.is_admin && (
                            <Badge className="bg-blue-600">
                                <ShieldCheck className="w-3 h-3 mr-1" /> Admin
                            </Badge>
                        )}
                    </div>
                </div>
            ) : (
                <div className="px-5 pt-5 text-center bg-slate-50/30 border-b border-dashed">
                    <h2 className="text-sm font-semibold text-slate-800">Sveiks, spēlētāj!</h2>
                    <p className="text-xs text-muted-foreground">Pieslēdzies, lai pieteiktos spēlēm</p>
                </div>
            )}

            {/* Form & Notifications Area */}
            <div className="px-5 pt-1 pb-5 space-y-6">
                <div className="space-y-1 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Profila iestatījumi
                    </span>
                    <UserForm profile={profile} />
                </div>
            
                {profile && (
                    <div className="border-t border-slate-50">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Paziņojumi
                        </span>
                        <Notifications />
                    </div>
                )}
            </div>
        </section>
    )
}