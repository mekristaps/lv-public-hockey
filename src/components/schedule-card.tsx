
import { useState, useEffect, Fragment } from "react";

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
    Phone,
    Lock,
    XCircle,
    PlusCircle,
    MinusCircle,
    UserPlus
} from "lucide-react";
import { registerAction, updateGuestsAction, UserProfile } from "@/lib/actions/profiles";

interface ScheduleCardProps {
    session: any;
    userRegisteredSessions: any;
    profile: UserProfile | null;
}

export function ScheduleCard({ session, userRegisteredSessions, profile }: ScheduleCardProps) {
    const [isPending, setIsPending] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<{text: string; type: "success" | "error";} | null>(null);

    let isAlreadyRegistered = null;
    let conflictingSession = null;
    let timeA = null;
    let timeB = null;
    let diffMinutes = null;
    let conflict = null;
    let currentReg = null;

    if (profile) {
        isAlreadyRegistered = session.registrations?.some((reg: any) => reg.profiles?.phone_number === profile?.phone_number);

        conflictingSession = userRegisteredSessions.find((s: any) => {
            if (s.id === session.id) {
                return false;
            }
            timeA = new Date(session.start_time).getTime();
            timeB = new Date(s.start_time).getTime();
            diffMinutes = Math.abs(timeA - timeB) / (1000 * 60);
            return diffMinutes < 120; // 2 hour window
        }) as any;

        conflict = !!conflictingSession;
        currentReg = session.registrations?.find((reg: any) => reg.profiles?.phone_number === profile?.phone_number);
    }

    const registrationCount = session.registrations?.length || 0;
    const totalPlayers = session.registrations?.reduce((acc: number, reg: any) => acc + 1 + (reg.guests_count || 0), 0) || 0;

    const isExpired = new Date(session.start_time).getTime() < new Date().getTime();

    const handleRegister = async (sessionId: string) => {
        if (!profile?.id) {
            alert("Lūdzu, vispirms saglabājiet savu profilu!");
            return;
        }
        
        setIsPending(true); // Start the global overlay spinner
        setStatusMessage(null);
        
        try {
            const result = await registerAction(profile.id, sessionId);
        
            if (!result.success) {
                alert(result.message);
                setIsPending(false);
            } else {
                setStatusMessage({ text: result.message, type: "success" });
        
                // Give the user 1000ms to see the success checkmark
                setTimeout(() => {
                    sessionStorage.setItem('scrollTarget', `session-${sessionId}`);
                    location.reload();
                }, 1000);
            }
        } catch (err) {
            setIsPending(false);
            alert("Notika neparedzēta kļūda.");
        }
    };
        
    const updateGuests = async (sessionId: string, newCount: number) => {
        if (!profile?.id) {
            alert("Lūdzu, vispirms saglabājiet savu profilu!");
            return;
        }
        
        setIsPending(true); // Start the global overlay spinner
        setStatusMessage(null);
        
        try {
            const validatedCount = Math.max(0, newCount);
            const result = await updateGuestsAction(profile.id, sessionId, validatedCount);
        
            if (!result.success) {
                alert(result.message);
                setIsPending(false);
            } else {
                setStatusMessage({ text: result.message, type: "success" });
        
                // Give the user 1000ms to see the success checkmark
                setTimeout(() => {
                    sessionStorage.setItem('scrollTarget', `session-${sessionId}`);
                    location.reload();
                }, 1000);
            }
        } catch (error) {
            setIsPending(false);
            alert("Notika neparedzēta kļūda.");
        }
    };

    useEffect(() => {
        const targetId = sessionStorage.getItem('scrollTarget');
        if (targetId) {
            const element = document.getElementById(targetId);
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: "smooth" });
                    sessionStorage.removeItem('scrollTarget');
                }, 100);
            }
        }
    }, []);

    if (isPending) {

        return (
            <div className="max-w-md mx-auto p-4 space-y-6 pb-20">
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
            </div>
        )
    }
    
    return (
        <Card
            id={`session-${session.id}`}
            className={`
                ${isAlreadyRegistered ? "border-green-500" : conflict ? "border-amber-500" : ""}
                ${isExpired ? "gap-1 opacity-60 grayscale-[0.5] pointer-events-none select-none bg-slate-50" : ""}
            `}
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
                            'Nav neviena spēlētāja'
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
                    {isAlreadyRegistered ? 
                        (
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
                        )
                    }
                </div>
                <div className="w-50 flex flex-wrap gap-4 justify-between items-center">
                    <div className="flex items-center justify-center w-full gap-1 text-xs font-medium text-center">
                        {isExpired ? 
                            (
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
                            )
                        }
                    </div>
                    {!isExpired && 
                        (
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
                        )
                    }
                </div>
            </CardFooter>
        </Card>
    )
}