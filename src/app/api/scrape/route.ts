import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";
import { parse } from "csv-parse/sync";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    // Define the arenas we expect to handle
    const EXPECTED_ARENAS = ["Marupe", "Volvo A", "Volvo B", "Volvo C", "Inbox"];

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    if (key !== process.env.CRON_SECRET) {
        return new Response("Unauthorized", { status: 401 });
    }
    const supabase = await createClient();

    // 2. Fetch last scrape time
    const { data: meta } = await supabase
        .from("site_metadata")
        .select("value")
        .eq("key", "last_scrape_time")
        .single();

    const lastRun = meta ? new Date(meta.value).getTime() : 0;
    const now = Date.now();
    const cooldownMs = 15 * 60 * 1000; // 15 minutes

    if (now - lastRun < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - (now - lastRun)) / 1000 / 60);
        return Response.json({
            success: true,
            message: `Skipped: Cooldown active. Try again in ${remaining} minutes.`,
        });
    }

    // 3. Update the timestamp IMMEDIATELY to prevent concurrent scrapes
    await supabase.from("site_metadata").upsert({
        key: "last_scrape_time",
        value: new Date().toISOString()
    });

    let allSessions: any[] = [];

    try {
        // MARUPE
        const marupeSchedule = await getMarupeSchedule();
        if (marupeSchedule && Array.isArray(marupeSchedule) && marupeSchedule.length > 0) {
            const marupeSessions = {
                source: "marupe",
                sessions: marupeSchedule,
            };
            allSessions = [...allSessions, marupeSessions];
        }

        // VOLVO
        const volvoSchedule = await getVolvoSchedule();
        if (volvoSchedule && Array.isArray(volvoSchedule) && volvoSchedule.length > 0) {
            const volvoSessions = {
                source: "volvo",
                sessions: volvoSchedule,
            };
            allSessions = [...allSessions, volvoSessions];
        }

        const inboxSchedule = await getInboxSchedule();
        if (inboxSchedule && Array.isArray(inboxSchedule) && inboxSchedule.length > 0) {
            const inboxSessions = {
                source: "inbox",
                sessions: inboxSchedule,
            };
            allSessions = [...allSessions, inboxSessions];
        }

        const rowsToUpsert = prepareSessionsForDatabase(allSessions);

        if (rowsToUpsert.length > 0) {
            // 1. Get the sources we actually just scraped
            const activeSources = EXPECTED_ARENAS;
            //const activeSources = [...new Set(rowsToUpsert.map(r => r.arena_name))];

            // 2. Fetch all upcoming sessions from DB for these specific arenas
            const { data: dbSessions } = await supabase
                .from("sessions")
                .select("id, arena_name, start_time, external_id")
                .in("arena_name", activeSources)
                .gt("start_time", new Date().toISOString());

            // 3. Handle deletions and time-shifts
            if (dbSessions) {
                for (const dbSession of dbSessions) {
                    const dateOnly = dbSession.start_time.split('T')[0];

                    // Is this exact session in the new scrape?
                    const stillExists = rowsToUpsert.find(r => r.external_id === dbSession.external_id);

                    if (!stillExists) {
                        // Find all scraped sessions for THIS arena on THIS day
                        const scrapedForThisDay = rowsToUpsert.filter(r =>
                            r.arena_name === dbSession.arena_name &&
                            r.start_time.startsWith(dateOnly)
                        );

                        // Find all DB sessions for THIS arena on THIS day
                        const dbForThisDay = dbSessions.filter(s =>
                            s.arena_name === dbSession.arena_name &&
                            s.start_time.startsWith(dateOnly)
                        );

                        // CASE: TIME CHANGE (Heuristic: Only one session existed and only one was scraped)
                        if (dbForThisDay.length === 1 && scrapedForThisDay.length === 1) {
                            const newSessionData = scrapedForThisDay[0];

                            // Update the existing ID with new time and external_id
                            await supabase.from("sessions")
                                .update({
                                    start_time: newSessionData.start_time,
                                    external_id: newSessionData.external_id
                                })
                                .eq("id", dbSession.id);

                            // TRIGGER NOTIFICATION: "Time changed for your game!"
                            const { error } = await supabase.rpc('trigger_session_sync_notification', {
                                p_session_id: dbSession.id,
                                p_type: "session_update",
                                p_arena_name: dbSession.arena_name,
                                p_old_time: dbSession.start_time,
                                p_new_time: newSessionData.start_time || null
                            });

                            // Remove from upsert list so we don't double-insert
                            const idx = rowsToUpsert.findIndex(r => r.external_id === newSessionData.external_id);
                            if (idx > -1) rowsToUpsert.splice(idx, 1);
                        }
                        else {
                            // CASE: DELETION
                            // 1. Notify everyone registered for dbSession.id

                            const { error } = await supabase.rpc('trigger_session_sync_notification', {
                                p_session_id: dbSession.id,
                                p_type: "session_cancellation",
                                p_arena_name: dbSession.arena_name,
                                p_old_time: dbSession.start_time,
                                p_new_time: null
                            });

                            // 2. Delete the session (Cascade will handle registrations)
                            await supabase.from("sessions").delete().eq("id", dbSession.id);
                        }
                    }
                }
            }

            // 4. Upsert whatever is left (New sessions)
            if (rowsToUpsert.length > 0) {

                const { error: dbError } = await supabase
                    .from("sessions")
                    .upsert(rowsToUpsert, { onConflict: "external_id" });

                if (dbError) throw dbError;
            }

        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            records_synced: rowsToUpsert.length,
            data: allSessions,
        });
    } catch (error) {
        console.error("Error during scraping:", error);
        return NextResponse.json(
            {
                success: false,
                error: error || "An error occurred during scraping",
            },
            { status: 500 },
        );
    } finally {
        console.log("Scraping completed at", new Date().toISOString());
    }
}

async function triggerPushNotification(
    sessionId: string,
    type: "session_update" | "session_cancellation",
    details: { arena_name: string; old_time?: string; new_time?: string }
) {
    // Call the Edge Function directly using the URL and your custom secret
    const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/push-reminders`;

    await fetch(functionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MY_NOTIFICATION_SECRET}`
        },
        body: JSON.stringify({
            type,
            session_id: sessionId,
            ...details
        })
    }).catch(err => console.error("Failed to trigger sync notification:", err));
}

function prepareSessionsForDatabase(allSchedules: any[]) {
    const flatRows: any[] = [];

    allSchedules.forEach((sourceGroup) => {
        const arenaSource = sourceGroup.source;
        if (!sourceGroup.sessions) return;

        sourceGroup.sessions.forEach((day: any) => {
            // 1. Handle Volvo (Nested arenas)
            if (day.arenas && Array.isArray(day.arenas)) {
                day.arenas.forEach((arenaRoom: any) => {
                    if (arenaRoom.schedule) {
                        processSlots(
                            arenaRoom.schedule,
                            day.dayDate,
                            arenaSource,
                            flatRows,
                            arenaRoom.arenaName // Pass "Laukums C" etc.
                        );
                    }
                });
            }
            // 2. Handle Marupe/Inbox (Direct schedule)
            else if (day.schedule && Array.isArray(day.schedule)) {
                processSlots(day.schedule, day.dayDate, arenaSource, flatRows);
            }
        });
    });

    return flatRows;
}

// Helper to keep the code clean and avoid repetition
function processSlots(
    schedule: any[],
    dayDate: string,
    source: string,
    rows: any[],
    specificArena?: string // Added optional parameter
) {
    schedule.forEach((slot: any) => {
        const startTimePart = slot.time.split("-")[0].split("–")[0].trim();
        const isoTimestamp = parseToISO(dayDate, startTimePart);

        if (isoTimestamp) {
            // --- NEW LOGIC FOR ARENA NAMES ---
            let displayName = source.charAt(0).toUpperCase() + source.slice(1);

            if (source.toLowerCase() === 'volvo' && specificArena) {
                // Extracts "A", "B", or "C" from "Laukums C"
                const letter = specificArena.split(' ').pop();
                displayName = `Volvo ${letter}`;
            }
            // ---------------------------------

            // Use the displayName in the externalId to ensure slots 
            // at the same time in different arenas don't overwrite each other
            const externalId = `${displayName.replace(/\s+/g, '')}_${isoTimestamp}`.replace(/[:.-]/g, "");

            rows.push({
                arena_name: displayName,
                activity_type: slot.name,
                start_time: isoTimestamp,
                external_id: externalId,
            });
        }
    });
}

function parseInboxSchedule(records: any[][]) {
    interface WeeklyScheduleItem {
        dayName: string;
        dayDate: string;
        schedule: any;
    }

    // Check if records exists and has at least one row (the header)
    if (!records || records.length === 0) {
        console.warn("No records found in CSV for Inbox");
        return [];
    }

    const headerRow = records[0];

    // Safety check for the specific headerRow variable
    if (!headerRow) {
        console.warn("Header row is undefined in Inbox CSV");
        return [];
    }

    const weeklySchedule: WeeklyScheduleItem[] = [];

    // 1. Initialize our days structure
    for (let col = 0; col < headerRow.length; col += 2) {
        if (headerRow[col]) {
            // Splitting "Pirmdiena, 2.marts" into name and date
            const [name, date] = headerRow[col]
                .split(",")
                .map((s: any) => s.trim());

            weeklySchedule.push({
                dayName: name || "",
                dayDate: date || "",
                schedule: [], // This will hold our { time, name } objects
            });
        }
    }

    // 2. Fill the schedule arrays
    for (let i = 1; i < records.length; i++) {
        const row = records[i];

        for (let dayIdx = 0; dayIdx < weeklySchedule.length; dayIdx++) {
            const timeCol = dayIdx * 2;
            const descCol = timeCol + 1;

            const time = row[timeCol] ? row[timeCol].trim() : "";
            const name = row[descCol] ? row[descCol].trim() : "";

            // Only add if there is a name (the activity)
            if (name) {
                weeklySchedule[dayIdx].schedule.push({
                    time: time || "Nav norādīts",
                    name: name,
                });
            }
        }
    }

    return weeklySchedule;
}

async function getInboxSchedule() {
    interface ScheduleItem {
        time: string | null;
        name: string | null;
    }

    interface DaySchedule {
        dayName: string | null;
        dayDate: string | null;
        schedule: ScheduleItem[];
    }

    if (!process.env.ARENA_INBOX_URL) {
        console.error("INBOX URL is not configured");
        return;
    }

    let scheduleData = null;

    try {
        const response = await axios.get(
            `${process.env.ARENA_INBOX_URL}/export?format=csv`,
        );
        const csvData = response.data;

        if (!csvData) {
            console.error("No CSV data received from Inbox Google Sheet");
            return [];
        }

        const records = parse(csvData, {
            columns: false,
            skip_empty_lines: true,
            relax_column_count: true,
        });
        const inboxSchedule = parseInboxSchedule(records);
        scheduleData = inboxSchedule.map((day) => ({
            ...day,
            schedule: day.schedule.filter((item: any) => {
                return item.name?.toLowerCase().includes("nūjām");
            }),
        })).filter((day) => day.schedule.length > 0);
    } catch (error) {
        console.error(error);
    }
    return scheduleData;
}

async function getVolvoSchedule() {
    interface ScheduleItem {
        time: string | null;
        name: string | null;
    }

    interface ArenaSchedule {
        arenaName: string | null;
        schedule: ScheduleItem[];
    }

    interface DaySchedule {
        dayName: string | null;
        dayDate: string | null;
        arenas: ArenaSchedule[];
    }

    if (!process.env.ARENA_VOLVO_URL) {
        console.error("VOLVO URL is not configured");
        return;
    }
    let scheduleData = [] as any;

    try {
        const { data } = await axios.get(`${process.env.ARENA_VOLVO_URL}`);

        if (!data) {
            console.error("Failed to load data for VOLVO!");
        }

        const $ = cheerio.load(data);

        $(".lncnt").each((index, element) => {
            let daySchedule: DaySchedule = {
                dayName: "",
                dayDate: "",
                arenas: [],
            };

            const dateArray = $(element)
                .find("div.day")
                .text()
                .trim()
                .split(",", 2);
            daySchedule.dayName = dateArray[0].trim();
            daySchedule.dayDate = dateArray[1].trim();

            const $dayListElement = $(element).find("ul.day");
            const $scheduleList = $dayListElement.find("li");

            $scheduleList.each((index, element) => {
                const $currentListElement = $(element);
                let currentArenaSchedule: ArenaSchedule = {
                    arenaName: "Laukums A",
                    schedule: [],
                };

                // Skip arena name list element
                if (index === 0 || index === 2 || index === 4) {
                    return;
                }

                // Set arena names for each schedule list element
                if (index === 1) {
                    currentArenaSchedule.arenaName = "Laukums A";
                } else if (index === 3) {
                    currentArenaSchedule.arenaName = "Laukums B";
                } else if (index === 5) {
                    currentArenaSchedule.arenaName = "Laukums C";
                }

                // If on actual schedule list
                if ($currentListElement.hasClass("colorize")) {
                    const $scheduleItemElement =
                        $currentListElement.find("div");

                    // Loop each div element inside schedule li element
                    $scheduleItemElement.each((index, element) => {
                        const $currentScheduleItem = $(element);
                        const time = $currentScheduleItem
                            .find("span")
                            .first()
                            .text()
                            .trim();
                        const name = $currentScheduleItem
                            .find("span")
                            .last()
                            .text()
                            .trim()
                            .toUpperCase();

                        // if name includes needed keyword
                        if (name.includes("NŪJĀM")) {
                            let currentScheduleItem: ScheduleItem = {
                                time: time,
                                name: name,
                            };

                            // Push only if it matches your criteria
                            currentArenaSchedule.schedule.push(
                                currentScheduleItem,
                            );
                        }
                    });
                } else {
                    return;
                }
                if (currentArenaSchedule.schedule.length > 0) {
                    daySchedule.arenas.push(currentArenaSchedule);
                }
            });

            if (daySchedule.arenas.length > 0) {
                scheduleData.push(daySchedule);
            }
        });
    } catch (error) {
        console.error(error);
    }

    return scheduleData;
}

async function getMarupeSchedule() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentWeek = getISOWeekNumber(now);

    interface ScheduleItem {
        time: string | null;
        name: string | null;
    }

    interface DaySchedule {
        dayName: string | null;
        dayDate: string | null;
        schedule: ScheduleItem[];
    }

    if (!process.env.ARENA_MARUPE_URL) {
        console.error("MARUPE URL is not configured");
        return;
    }

    const marupeURL = `${process.env.ARENA_MARUPE_URL}/${currentYear}/${currentWeek}`;
    let scheduleData = [] as any;
    try {
        const { data } = await axios.get(marupeURL);
        if (!data) {
            console.error("Failed to load data for MARUPE!");
        }
        const $ = cheerio.load(data);
        // Days table wrapper
        const $daysListWrapper = $(".days-list > .row");
        if (!$daysListWrapper) {
            console.error("Failed to look up days table for MARUPE!");
            return;
        }

        const $daysWrappers = $daysListWrapper.find("div.col-sm-3");
        $daysWrappers.each((index, element) => {
            let daySchedule: DaySchedule = {
                dayName: "",
                dayDate: "",
                schedule: [],
            };
            const $dateElement = $(element).find("div.title");
            const dateArray = $dateElement.text().trim().split(",", 2);
            daySchedule.dayName = dateArray[0].trim();
            daySchedule.dayDate = dateArray[1].trim();

            const $scheduleItemElement = $(element).find("tr");

            // Loop each div element inside schedule li element
            $scheduleItemElement.each((index, element) => {
                const $currentScheduleItem = $(element);
                const time = $currentScheduleItem
                    .find("tr div")
                    .first()
                    .text()
                    .trim();
                const name = $currentScheduleItem
                    .find("tr div")
                    .last()
                    .text()
                    .trim()
                    .toUpperCase();

                // if name includes needed keyword
                if (name.includes("NŪJĀM")) {
                    let currentScheduleItem: ScheduleItem = {
                        time: time,
                        name: name,
                    };

                    // Push only if it matches your criteria
                    daySchedule.schedule.push(currentScheduleItem);
                }
            });

            if (daySchedule.schedule.length > 0) {
                scheduleData.push(daySchedule);
            }
        });
    } catch (error) {
        console.error(error);
    }
    return scheduleData;
}

function getISOWeekNumber(date: any) {
    const tempDate = new Date(date.getTime());
    // Thursday in current week decides the year.
    tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
    // January 4 is always in week 1.
    const week1 = new Date(tempDate.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count number of weeks from date to week1.
    return (
        1 +
        Math.round(
            ((tempDate.getTime() - week1.getTime()) / 86400000 -
                3 +
                ((week1.getDay() + 6) % 7)) /
            7,
        )
    );
}

function parseToISO(dateStr: string, timeStr: string) {
    try {
        const now = new Date();
        // Force the "current" reference to Riga time
        const rigaNow = new Date(
            now.toLocaleString("en-US", { timeZone: "Europe/Riga" }),
        );
        let year = rigaNow.getFullYear();

        // 1. Handle Month Mapping (Latvian)
        const monthMap: { [key: string]: number } = {
            janvāris: 1,
            februāris: 2,
            marts: 3,
            aprīlis: 4,
            maijs: 5,
            jūnijs: 6,
            jūlijs: 7,
            augusts: 8,
            septembris: 9,
            oktobris: 10,
            novembris: 11,
            decembris: 12,
            jan: 1,
            feb: 2,
            mar: 3,
            apr: 4,
            mai: 5,
            jūn: 6,
            jūl: 7,
            aug: 8,
            sep: 9,
            okt: 10,
            nov: 11,
            dec: 12,
        };

        let day: number, month: number;

        // 2. Extract Day and Month
        if (dateStr.includes(".")) {
            const parts = dateStr.split(".");
            day = parseInt(parts[0]);
            // Check if second part is a number (03) or a word (marts)
            const secondPart = parts[1]?.trim().toLowerCase();
            month = isNaN(Number(secondPart))
                ? monthMap[secondPart]
                : parseInt(secondPart);
        } else {
            // Handle "14 marts" (no dot)
            const parts = dateStr.split(" ");
            day = parseInt(parts[0]);
            month = monthMap[parts[1]?.toLowerCase()];
        }

        // 3. Extract Time (First part of "19:45-20:45")
        const timePart = timeStr.split(/[-–]/)[0].trim();
        const [hours, minutes] = timePart.split(":").map(Number);

        if (!day || !month || isNaN(hours)) return null;

        // 4. Construct ISO String with Riga Offset (+02:00 or +03:00)
        // This format ensures Supabase knows exactly when it happens in Latvia
        const pad = (n: number) => n.toString().padStart(2, "0");

        // Check for Year Flip (If it's Dec and we see Jan)
        if (rigaNow.getMonth() === 11 && month === 1) year++;

        // Construct a string that JS Date can parse as local Latvian time
        // YYYY-MM-DDTHH:mm:ss in Riga
        const isoNoZone = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;

        // Create the date object and specify it's Riga time
        const finalDate = new Date(isoNoZone.replace(" ", "T") + "+02:00");
        // Note: For absolute precision, use a library like 'luxon' to handle DST automatically,
        // but +02:00 works for winter time in Latvia.

        return finalDate.toISOString();
    } catch (e) {
        return null;
    }
}
