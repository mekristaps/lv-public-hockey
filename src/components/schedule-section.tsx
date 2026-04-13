'use client'

import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { getSchedule } from "@/lib/actions/schedule";

import { CalendarDays } from "lucide-react";

import { FullScreenLoader } from "./full-screen-loader";
import { ScheduleCard } from "./schedule-card";


export function ScheduleSection() {
    const [dbSessions, setDbSessions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const { profile } = useUser();

    // group sessions by day for UI
    const groupedSchedule = dbSessions.reduce((acc: any, session) => {
        const dateKey = new Date(session.start_time).toLocaleDateString(
            "lv-LV",
            {
                weekday: "long",
                day: "2-digit",
                month: "long",
            },
        );
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(session);
        return acc;
    }, {});

    // get flat list of all sessions from all dates
    const allSessions = Object.values(groupedSchedule).flat();

    // filter to find only the sessions where the current user's profile ID exists
    const userRegisteredSessions = allSessions.filter((session: any) => session.registrations?.some((reg: any) => reg.profiles?.id === profile?.id));

    useEffect(() => {
        async function loadInitialData() {
            setIsLoading(true);
            
            try {
                const sessions = await getSchedule();
                setDbSessions(sessions || []);
    
                // trigger Scraper
                // do this after main data is loaded so it doesnt slow down UI
                fetch("/api/scrape?key=Z7Fl6JoDMLbE6EpYypxZbwzfgsl96/es0qf1gaykWkc=")
                    .catch(() => console.log("Scrape cooldown or error"));

            } catch (error) {
                console.error("Data load failed:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadInitialData();
    }, []);

    if (isLoading) {
        return <FullScreenLoader />
    }

    return (
        <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Grafiks
            </h2>
            {/* Render Real Schedule */}
            {Object.keys(groupedSchedule).map((date) => {
                // Here 'date' is defined by the .map function
                return (
                    <section key={date} className="space-y-4">
                        {/* Date Header */}
                        <div className="flex items-center gap-2 sticky top-0 py-2 z-10 bg-white/80 backdrop-blur-sm">
                            <CalendarDays className="w-4 h-4 text-primary" />
                            <h2 className="text-sm font-bold text-slate-700 capitalize">
                                {date}
                            </h2>
                            <div className="h-[1px] flex-1 bg-slate-100 ml-2"></div>
                        </div>

                        {groupedSchedule[date].map((session: any) => {

                            return (
                                <ScheduleCard
                                    key={session.id} 
                                    session={session} 
                                    userRegisteredSessions={userRegisteredSessions} 
                                    profile={profile ? profile : null} 
                                />
                            );
                        })}
                    </section>
                );
            })}
        </section>
    )
}