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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    CheckCircle2,
    Trophy,
    CalendarDays,
    ShieldCheck,
    Phone,
    Lock,
    XCircle,
    PlusCircle,
    MinusCircle,
    UserPlus,
    HelpCircle
} from "lucide-react";
import InstallButton from "@/components/InstallButton";
import Notifications from "@/components/Notifications";

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
    // 1. User State
    const [isMounted, setIsMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [profile, setProfile] = useState<UserProfile>();
    const [dbSessions, setDbSessions] = useState<any[]>([]);

    const [isPending, setIsPending] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{text: string; type: "success" | "error";} | null>(null);

    const [isHelpSent, setIsHelpSent] = useState(false);

    // 2. Load profile from local storage on mount
    const supabase = createClient();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        async function loadInitialData() {
            setIsLoading(true);

            try {
                // 1. Get the SAVED profile from Local Storage
                const savedData = localStorage.getItem("hokejs_user_session");
                const parsedSession = savedData ? JSON.parse(savedData) : null;

                // 2. Parallel Fetch
                const [userProfile, sessions] = await Promise.all([
                    parsedSession?.phone_number 
                        ? getUserProfile(supabase, parsedSession.phone_number) 
                        : Promise.resolve(null), 
                    getSchedule(supabase)
                ]);

                // 3. Verify the session is still valid (PIN hasn't changed)
                console.log(userProfile);
                if (userProfile && parsedSession && userProfile.pin_code === parsedSession.pin_code) {
                    setProfile(userProfile);
                } else {
                    // If PIN changed or user not found, clear local storage
                    if (parsedSession) {
                        localStorage.removeItem("hokejs_user_session")
                    };
                    setProfile(undefined);
                }
                setDbSessions(sessions || []);

                // 3. Background Trigger for Scraper
                // We do this after the main data is loaded so it doesn't slow down the UI
                fetch("/api/scrape?key=Z7Fl6JoDMLbE6EpYypxZbwzfgsl96/es0qf1gaykWkc=").catch(() => console.log("Scrape cooldown or error"));
            } catch (error) {
                console.error("Data load failed:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadInitialData();
    }, [isMounted]);

    // 3. Group sessions by day for the UI
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

    // Get a flat list of all sessions from all dates
    const allSessions = Object.values(groupedSchedule).flat();

    // Filter to find only the sessions where the current user's profile ID exists
    const userRegisteredSessions = allSessions.filter((s: any) => s.registrations?.some((reg: any) => reg.profiles?.phone_number === profile?.phone_number));

    // 4. Wrap Action to sync LocalStorage after success
    const profileDispatchAction = async (prevFormState: any, formData: FormData) => {
        const result = await profileAction(prevFormState, formData);

        if (result?.success && result.user) {
            // Guard for Client-Side only execution
            const isBrowser = typeof globalThis !== "undefined" && (globalThis as any).localStorage;

            if (isBrowser) {
                const sessionData = {
                    phone_number: result.user.phone_number,
                    pin_code: result.user.pin_code,
                    full_name: result.user.full_name
                };
                (globalThis as any).localStorage.setItem("hokejs_user_session", JSON.stringify(sessionData));
                (globalThis as any).localStorage.setItem("hokejs_phone", result.user.phone);
                (globalThis as any).localStorage.setItem("hokejs_name", result.user.name);
            }

            setIsPending(true); // Start the global overlay spinner
            setStatusMessage({ text: result.message, type: "success" });
            setProfile(result.user);

            setStatusMessage({ text: result.message, type: "success" });
            // Give the user 1000ms to see the success checkmark
            setTimeout(() => {
                if (typeof globalThis !== "undefined" && (globalThis as any).location) {
                    (globalThis as any).location.reload();
                }
            }, 1000);
        }
        return result;
    };

    const initialFormValues: FormFields = {
        phone: profile?.phone_number || "",
        full_name: profile?.full_name || "",
    };

    const [formState, formAction] = useActionState(profileDispatchAction, {});
    const error = formState?.error;

    const handleRequestHelp = async () => {
        const { phone, name, pin } = formState?.failedAttempt || {};

        const result = await requestPinHelpAction(phone, name, pin);
        if (result.success) {
            setIsHelpSent(true);
        }
    };

    const handleRegister = async (sessionId: string) => {
        if (!profile?.id) {
            if (typeof globalThis !== "undefined" && (globalThis as any).alert) {
                (globalThis as any).alert("Lūdzu, vispirms saglabājiet savu profilu!");
            }
            return;
        }

        setIsPending(true); // Start the global overlay spinner
        setStatusMessage(null);

        try {
            const result = await registerAction(profile.id, sessionId);

            if (!result.success) {
                if (typeof globalThis !== "undefined" && (globalThis as any).alert) {
                    (globalThis as any).alert(result.message);
                }
                setIsPending(false);
            } else {
                setStatusMessage({ text: result.message, type: "success" });

                // Give the user 1000ms to see the success checkmark
                setTimeout(() => {
                    if (typeof globalThis !== "undefined" && (globalThis as any).location) {
                        (globalThis as any).location.reload();
                    }
                }, 1000);
            }
        } catch (err) {
            setIsPending(false);
            if (typeof globalThis !== "undefined" && (globalThis as any).alert) {
                (globalThis as any).alert("Notika neparedzēta kļūda.");
            }
        }
    };

    const updateGuests = async (sessionId: string, newCount: number) => {
        if (!profile?.id) {
            if (typeof globalThis !== "undefined" && (globalThis as any).alert) {
                (globalThis as any).alert("Lūdzu, vispirms saglabājiet savu profilu!");
            }
            return;
        }

        setIsPending(true); // Start the global overlay spinner
        setStatusMessage(null);

        try {
            const validatedCount = Math.max(0, newCount);
            const result = await updateGuestsAction(profile.id, sessionId, validatedCount);

            if (!result.success) {
                if (typeof globalThis !== "undefined" && (globalThis as any).alert) {
                    (globalThis as any).alert(result.message);
                }
                setIsPending(false);
            } else {
                setStatusMessage({ text: result.message, type: "success" });

                // Give the user 1000ms to see the success checkmark
                setTimeout(() => {
                    if (typeof globalThis !== "undefined" && (globalThis as any).location) {
                        (globalThis as any).location.reload();
                    }
                }, 1000);
            }
        } catch (error) {
            setIsPending(false);
            if (typeof globalThis !== "undefined" && (globalThis as any).alert) {
                (globalThis as any).alert("Notika neparedzēta kļūda.");
            }
        }

    };

    const loadingPhrases = [
        "Salst ledus... ❄️",
        "Tīra ledu... 🏒",
        "Meklējam ripas... 🔍",
        "Sienam slidas... ⛸️",
        "Gatavojam vārtus... 🥅",
        "Asinām slidas... ✨",
    ];

    // Inside your HockeyDashboard component:
    const loadingText = useMemo(() => {
        return loadingPhrases[Math.floor(Math.random() * loadingPhrases.length)];
    }, []);

    if (isLoading) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50">
                {/* Optional: Add a spinner above the text */}
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <div className="text-lg font-bold text-slate-700 animate-pulse">
                    {loadingText}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto p-4 space-y-6 pb-20">
            {/* Loading Overlay */}
            {isPending && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md transition-opacity">
                    <div className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-2xl border border-slate-100">
                        {statusMessage?.type === "success" ? (
                            <>
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 animate-bounce">
                                    <CheckCircle2 className="w-10 h-10" />
                                </div>
                                <p className="text-lg font-bold text-slate-800">
                                    {statusMessage.text}
                                </p>
                                <p className="text-sm text-slate-500">
                                    Atjaunina sarakstu...
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-slate-600 font-medium">
                                    Lūdzu, uzgaidiet...
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}
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
            <section className="p-4 bg-white rounded-xl border shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {profile ? `Sveiks ${profile.full_name}` : "Izveido profilu!"}
                    </h2>
                    {profile?.is_admin && (
                        <Badge className="bg-blue-600">
                            <ShieldCheck className="w-3 h-3 mr-1" /> Admin
                        </Badge>
                    )}
                </div>
                <form action={formAction} className="space-y-2">
                    {profile && (
                        <input type="hidden" name="current_session_pin" value={profile.pin_code} />
                    )}
                    <Input
                        placeholder="Vārds"
                        name="full_name"
                        id="full_name"
                        defaultValue={initialFormValues.full_name}
                        title="Lūdzu ievadiet Vārdu un Uzvārdu (tikai burti)"
                        className="h-9"
                        required
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            placeholder="Telefona numurs"
                            type="tel"
                            name="phone"
                            id="phone"
                            minLength={8}
                            defaultValue={initialFormValues.phone}
                            pattern="[0-9]{8,12}"
                            title="Telefona numuram jābūt vismaz 8 cipariem (bez burtiem)"
                            className="h-9 flex-1"
                            required
                        />
                        {/* PIN INPUT */}
                        <div className="relative flex-1 min-w-55">
                            <Input
                                placeholder={profile ? "Mainīt PIN (min 4 cipari)" : "Vismaz 4-ciparu PIN"}
                                name="pin_code"
                                id="pin_code"
                                type="password"
                                inputMode="numeric"
                                minLength={4}
                                pattern="[0-9]*"
                                className="h-9 pl-8"
                                required={!profile} // Only required for first-time creation
                            />
                            <Lock className="w-3 h-3 absolute left-3 top-3 text-muted-foreground" />
                        </div>
                    </div>
                     {!profile && (
                        <p className="text-[10px] text-center text-muted-foreground">
                                PIN jāsastāv vismaz no 4 cipariem!
                        </p>
                    )}
                    {formState?.error === "Nepareizs PIN kods šim numuram!" && !isHelpSent && (
                        <div className="mt-2 p-3 border border-amber-200 bg-amber-50 rounded-lg space-y-2">
                            <p className="text-[11px] text-amber-800">
                                Aizmirsi savu PIN? Noklikšķini zemāk, un ar tevi sazināsies.
                            </p>
                            <Button 
                                type="button"
                                variant="outline" 
                                size="sm" 
                                className="w-full bg-white border-amber-300 text-amber-700 hover:bg-amber-100 h-8 text-xs"
                                onClick={(e) => {
                                    e.preventDefault(); // Prevent form submission
                                    handleRequestHelp();
                                }}
                            >
                                <HelpCircle className="w-3 h-3 mr-1" /> Nevaru pieslēgties
                            </Button>
                        </div>
                    )}

                    {isHelpSent && (
                        <p className="text-[11px] text-green-600 font-medium text-center">
                            📩 Pieprasījums nosūtīts. Gaidi ziņu!
                        </p>
                    )}
                    <div className="flex flex-col gap-2">
                        <Button size="sm" className="w-full">
                            {profile ? "Saglabāt izmaiņas" : "Izveidot un autorizēties"}
                        </Button>
                        
                        {profile && (
                            <p className="text-[10px] text-center text-muted-foreground">
                                PIN nepieciešams, lai pieteiktos no citas ierīces.
                            </p>
                        )}
                    </div>
                </form>
                <Notifications />
            </section>

            {/* Schedule Section */}
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
                                // 2. NOW we are inside the session loop.
                                // We check if THIS session conflicts with the user's sessions.

                                const isAlreadyRegistered = session.registrations?.some((reg: any) => reg.profiles?.phone_number === profile?.phone_number);

                                const conflictingSession = userRegisteredSessions.find((s: any) => {
                                    if (s.id === session.id) {
                                        return false;
                                    }
                                    const timeA = new Date(session.start_time).getTime();
                                    const timeB = new Date(s.start_time).getTime();
                                    const diffMinutes = Math.abs(timeA - timeB) / (1000 * 60);

                                    return diffMinutes < 120; // 2 hour window
                                }) as any;

                                const conflict = !!conflictingSession;
                                const currentReg = session.registrations?.find((reg: any) => reg.profiles?.phone_number === profile?.phone_number);

                                const registrationCount = session.registrations?.length || 0;
                                const totalPlayers = session.registrations?.reduce((acc: number, reg: any) => acc + 1 + (reg.guests_count || 0), 0) || 0;

                                const isExpired = new Date(session.start_time).getTime() < new Date().getTime();
                                // ... Rest of your Card rendering code ...
                                return (
                                    <Card
                                        key={session.id}
                                        className={`
                                            ${isAlreadyRegistered ? "border-green-500" : conflict ? "border-amber-500" : ""}
                                            ${isExpired ? "gap-1 opacity-60 grayscale-[0.5] pointer-events-none select-none bg-slate-50" : ""}
                                        `}
                                        //className={isAlreadyRegistered ? "border-green-500" : conflict ? "border-amber-500" : ""}
                                    >
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <CardTitle className="text-lg">
                                                        {session.arena_name}
                                                    </CardTitle>
                                                    <CardDescription>
                                                        {session.activity_type}
                                                    </CardDescription>
                                                </div>
                                                <Badge
                                                    variant="secondary"
                                                    className="text-md"
                                                >
                                                    {new Date(session.start_time).toLocaleTimeString("lv-LV",
                                                        {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        }
                                                    )}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Users className="w-4 h-4" />
                                                <span>
                                                    {totalPlayers === 0 ? (
                                                        <>
                                                            Nav neviena spēlētāja
                                                        </>
                                                    ) : (
                                                        <>
                                                            {totalPlayers} spēlētāj{totalPlayers === 1 ? 's' : 'i'}
                                                            {" "}
                                                            {totalPlayers === 1 ? "pieteicies" : "pieteikušies"}
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-3">
                                                {session.registrations?.map((reg: any) => (
                                                    <Fragment key={reg.id}>
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[12px] font-normal"
                                                        >
                                                            {reg.profiles.full_name}
                                                            {profile?.is_admin && (
                                                                <a
                                                                    href={`tel:${reg.profiles.phone_number}`}
                                                                    className="text-blue-600 flex items-center gap-1 font-mono text-xs hover:underline"
                                                                >
                                                                    <Phone className="w-2 h-2 inline ml-1" />
                                                                    {reg.profiles.phone_number}
                                                                </a>
                                                            )}
                                                        </Badge>
                                                        {/* The Guest Badges (Visualizing the "Plus ones") */}
                                                        {[...Array(reg.guests_count || 0)].map((_, i) => (
                                                            <Badge 
                                                                key={`${reg.id}-guest-${i}`} 
                                                                variant="secondary" 
                                                                className="text-[10px] font-normal bg-slate-50 text-slate-500 border-dashed border-slate-300"
                                                            >
                                                                <UserPlus className="w-2 h-2 mr-1" />
                                                                {reg.profiles.full_name.split(' ')[0]} +1
                                                            </Badge>
                                                        ))}
                                                    </Fragment>
                                                    

                                                ))}
                                            </div>
                                        </CardContent>
                                        <CardFooter className="flex flex-col justify-between items-center pt-4">
                                            <div className="text-xs font-bold">
                                                {isAlreadyRegistered ? (
                                                    <span className="text-green-600 flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        {" "}
                                                        Pieteicies
                                                    </span>
                                                ) : conflict ? (
                                                    <span className="text-amber-600 flex items-center gap-1">
                                                        <Lock className="w-3 h-3" />
                                                        Pārklājas ar{" "}
                                                        {conflictingSession.arena_name}
                                                        {" "}
                                                        (
                                                            {new Date(conflictingSession.start_time).toLocaleTimeString("lv-LV",
                                                                {
                                                                    hour: "2-digit",
                                                                    minute: "2-digit",
                                                                }
                                                            )}
                                                        )
                                                    </span>
                                                ) : (
                                                    <></>
                                                )}
                                            </div>
                                            <div className="w-50 flex flex-wrap gap-4 justify-between items-center">
                                                <div className="flex items-center justify-center w-full gap-1 text-xs font-medium text-center">
                                                    {isExpired ? (
                                                        totalPlayers >= 6 ? (
                                                            <span className="text-slate-500 flex items-center gap-1">
                                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                                Sastāvs tika savākts
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 flex items-center gap-1">
                                                                <XCircle className="w-4 h-4 text-red-400" />
                                                                Sastāvs netika savākts
                                                            </span>
                                                        )
                                                    ) : (
                                                        // Active Session Logic (Your existing code)
                                                        totalPlayers >= 6 ? (
                                                            <span className="text-green-600 flex items-center gap-1">
                                                                <CheckCircle2 className="w-4 h-4" />
                                                                Minimālais skaits savākts!
                                                            </span>
                                                        ) : (
                                                            <span className="text-amber-600">
                                                                Vajag vēl {6 - (totalPlayers || 0)} spēlētāj{(6 - totalPlayers) === 1 ? 'u' : 'us'}
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                                {!isExpired && (
                                                    <div className="flex items-end gap-2 w-full">
                                                        <Button
                                                            disabled={!profile}
                                                            variant={isAlreadyRegistered ? "destructive" : conflict ? "secondary" : "default"}
                                                            onClick={() => handleRegister(session.id)}
                                                            className="flex-1 h-10"
                                                        >
                                                            {isAlreadyRegistered ? (
                                                                <>
                                                                    <XCircle className="w-4 h-4 mr-2" />
                                                                    Atteikties
                                                                </>
                                                            ) : conflict ? (
                                                                "Mainīt uz šo"
                                                            ) : (
                                                                "Pieteikties"
                                                            )}
                                                        </Button>
                                                        {/* GUEST STEPPER */}
                                                        {isAlreadyRegistered && (
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className="text-[10px] uppercase font-bold text-slate-400">Viesi</span>
                                                                <div className="flex items-center bg-slate-100 rounded-md px-1 py-1 gap-2 border border-slate-200">
                                                                    <button
                                                                        onClick={() => updateGuests(session.id, (currentReg.guests_count || 0) - 1)}
                                                                        className="p-1 hover:bg-white rounded-sm transition-colors disabled:opacity-30"
                                                                        disabled={(currentReg.guests_count || 0) <= 0}
                                                                    >
                                                                        <MinusCircle className="w-5 h-5 text-slate-600" />
                                                                    </button>

                                                                    <span className="text-sm font-bold min-w-[24px] text-center">
                                                                        +{currentReg.guests_count || 0}
                                                                    </span>

                                                                    <button
                                                                        onClick={() => updateGuests(session.id, (currentReg.guests_count || 0) + 1)}
                                                                        className="p-1 hover:bg-white rounded-sm transition-colors text-slate-600"
                                                                    >
                                                                        <PlusCircle className="w-5 h-5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            
                                                        )}
                                                    </div>
                                                )}
                                                
                                            </div>
                                        </CardFooter>
                                    </Card>
                                );
                            })}
                        </section>
                    );
                })}
            </section>

            {/* Fixed bottom nav placeholder */}
            {/* <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-3 flex justify-around text-muted-foreground">
				<Trophy className="w-6 h-6 text-primary" />
				<Users className="w-6 h-6" />
			</div> */}
        </div>
    );
}
