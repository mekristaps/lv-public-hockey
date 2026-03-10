"use client";

import { useState, useEffect, useActionState, useMemo } from "react";

import { createClient } from "@/lib/supabase/client";
import { getUserProfile, getSchedule } from "@/lib/supabase/queries";
import { profileAction, registerAction } from "@/lib/actions/profiles";

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
	const [statusMessage, setStatusMessage] = useState<{
		text: string;
		type: "success" | "error";
	} | null>(null);

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
				// 1. Check Local Storage (Safe check for build)
				// Inside your useEffect
				const savedPhone =
					typeof globalThis !== "undefined"
						? (globalThis as any).localStorage?.getItem(
								"hokejs_phone",
							)
						: null;

				// 2. Parallel Fetch: Profile and Schedule
				const [userProfile, sessions] = await Promise.all([
					savedPhone
						? getUserProfile(supabase, savedPhone)
						: Promise.resolve(null),
					getSchedule(supabase),
				]);

				if (userProfile) {
					setProfile(userProfile);
				}
				setDbSessions(sessions || []);

				// 3. Background Trigger for Scraper
				// We do this after the main data is loaded so it doesn't slow down the UI
				fetch(
					"/api/scrape?key=Z7Fl6JoDMLbE6EpYypxZbwzfgsl96/es0qf1gaykWkc=",
				).catch(() => console.log("Scrape cooldown or error"));
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
		if (!acc[dateKey]) acc[dateKey] = [];
		acc[dateKey].push(session);
		return acc;
	}, {});

	// Get a flat list of all sessions from all dates
	const allSessions = Object.values(groupedSchedule).flat();

	// Filter to find only the sessions where the current user's profile ID exists
	const userRegisteredSessions = allSessions.filter((s: any) =>
		s.registrations?.some(
			(reg: any) => reg.profiles?.phone_number === profile?.phone_number,
		),
	);

	// 4. Wrap Action to sync LocalStorage after success
	const profileDispatchAction = async (
		prevFormState: any,
		formData: FormData,
	) => {
		const result = await profileAction(prevFormState, formData);

		if (result?.success && result.user) {
			// Guard for Client-Side only execution
			const isBrowser =
				typeof globalThis !== "undefined" &&
				(globalThis as any).localStorage;

			if (isBrowser) {
				(globalThis as any).localStorage.setItem(
					"hokejs_phone",
					result.user.phone,
				);
				(globalThis as any).localStorage.setItem(
					"hokejs_name",
					result.user.name,
				);
			}

			setIsPending(true); // Start the global overlay spinner
			setStatusMessage({ text: result.message, type: "success" });

			setProfile((prev) => ({
				...prev!,
				full_name: result.user.name,
				phone_number: result.user.phone,
			}));

			setStatusMessage({ text: result.message, type: "success" });

			// Give the user 1000ms to see the success checkmark
			setTimeout(() => {
				if (
					typeof globalThis !== "undefined" &&
					(globalThis as any).location
				) {
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

	const handleRegister = async (sessionId: string) => {
		if (!profile?.id) {
			if (
				typeof globalThis !== "undefined" &&
				(globalThis as any).alert
			) {
				(globalThis as any).alert(
					"Lūdzu, vispirms saglabājiet savu profilu!",
				);
			}
			return;
		}

		setIsPending(true); // Start the global overlay spinner
		setStatusMessage(null);

		try {
			const result = await registerAction(profile.id, sessionId);

			if (!result.success) {
				if (
					typeof globalThis !== "undefined" &&
					(globalThis as any).alert
				) {
					(globalThis as any).alert(result.message);
				}
				setIsPending(false);
			} else {
				setStatusMessage({ text: result.message, type: "success" });

				// Give the user 1000ms to see the success checkmark
				setTimeout(() => {
					if (
						typeof globalThis !== "undefined" &&
						(globalThis as any).location
					) {
						(globalThis as any).location.reload();
					}
				}, 1000);
			}
		} catch (err) {
			setIsPending(false);
			if (
				typeof globalThis !== "undefined" &&
				(globalThis as any).alert
			) {
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
		return loadingPhrases[
			Math.floor(Math.random() * loadingPhrases.length)
		];
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
						{profile
							? `Sveiks ${profile.full_name}`
							: "Izveido profilu!"}
					</h2>
					{profile?.is_admin && (
						<Badge className="bg-blue-600">
							<ShieldCheck className="w-3 h-3 mr-1" /> Admin
						</Badge>
					)}
				</div>
				<form action={formAction} className="space-y-2">
					<Input
						placeholder="Vārds Uzvārds"
						name="full_name"
						id="full_name"
						defaultValue={initialFormValues.full_name}
						className="h-9"
					/>
					<div className="flex gap-2">
						<Input
							placeholder="Telefona numurs"
							name="phone"
							id="phone"
							defaultValue={initialFormValues.phone}
							className="h-9"
						/>
						<Button size="sm" className="px-4">
							{profile ? "Saglabāt izmaiņas" : "Izveidot"}
						</Button>
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

								const isAlreadyRegistered =
									session.registrations?.some(
										(reg: any) =>
											reg.profiles?.phone_number ===
											profile?.phone_number,
									);

								const conflictingSession =
									userRegisteredSessions.find((s: any) => {
										if (s.id === session.id) return false;

										const timeA = new Date(
											session.start_time,
										).getTime();
										const timeB = new Date(
											s.start_time,
										).getTime();
										const diffMinutes =
											Math.abs(timeA - timeB) /
											(1000 * 60);

										return diffMinutes < 120; // 2 hour window
									}) as any;

								const conflict = !!conflictingSession;
								const registrationCount =
									session.registrations?.length || 0;

								// ... Rest of your Card rendering code ...
								return (
									<Card
										key={session.id}
										className={
											isAlreadyRegistered
												? "border-green-500"
												: conflict
													? "border-amber-500"
													: ""
										}
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
													{new Date(
														session.start_time,
													).toLocaleTimeString(
														"lv-LV",
														{
															hour: "2-digit",
															minute: "2-digit",
														},
													)}
												</Badge>
											</div>
										</CardHeader>
										<CardContent>
											<div className="flex items-center gap-2 text-sm text-muted-foreground">
												<Users className="w-4 h-4" />
												<span>
													{session.registrations
														?.length || 0}{" "}
													spēlētāj
													{session.registrations
														?.length === 1
														? "s"
														: "i"}{" "}
													{session.registrations
														?.length === 1
														? "pieteicies"
														: "pieteikušies"}
												</span>
											</div>
											<div className="flex flex-wrap gap-1 mt-3">
												{session.registrations?.map(
													(reg: any) => (
														<Badge
															key={reg.id}
															variant="outline"
															className="text-[12px] font-normal"
														>
															{
																reg.profiles
																	.full_name
															}
															{profile?.is_admin && (
																<a
																	href={`tel:${reg.profiles.phone_number}`}
																	className="text-blue-600 flex items-center gap-1 font-mono text-xs hover:underline"
																>
																	<Phone className="w-2 h-2 inline ml-1" />
																	{
																		reg
																			.profiles
																			.phone_number
																	}
																</a>
															)}
														</Badge>
													),
												)}
											</div>
										</CardContent>
										<CardFooter className="flex flex-col justify-between items-center pt-4">
											<div className="text-xs font-bold">
												{isAlreadyRegistered ? (
													<span className="text-green-600 flex items-center gap-1">
														<CheckCircle2 className="w-3 h-3" />{" "}
														Pieteicies
													</span>
												) : conflict ? (
													<span className="text-amber-600 flex items-center gap-1">
														<Lock className="w-3 h-3" />
														Pārklājas ar{" "}
														{
															conflictingSession.arena_name
														}{" "}
														(
														{new Date(
															conflictingSession.start_time,
														).toLocaleTimeString(
															"lv-LV",
															{
																hour: "2-digit",
																minute: "2-digit",
															},
														)}
														)
													</span>
												) : (
													<span className="text-slate-400">
														Brīvs grafiks
													</span>
												)}
											</div>
											<div className="w-50 flex flex-wrap gap-4 justify-between items-center pt-4">
												<div className="flex items-center gap-1 text-xs font-medium">
													{session.registrations
														?.length >= 6 ? (
														<span className="text-green-600 flex items-center gap-1">
															<CheckCircle2 className="w-4 h-4" />{" "}
															Notiek!
														</span>
													) : (
														<span className="text-amber-600">
															Vajag vēl{" "}
															{6 -
																(session
																	.registrations
																	?.length ||
																	0)}
														</span>
													)}
												</div>
												<Button
													disabled={!profile}
													variant={
														isAlreadyRegistered
															? "destructive"
															: conflict
																? "secondary"
																: "default"
													}
													onClick={() =>
														handleRegister(
															session.id,
														)
													}
													className="w-full sm:w-auto"
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
