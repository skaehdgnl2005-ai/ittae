import { ReauthRequiredError } from "./oauth";

export type GoogleEvent = {
  id: string;
  summary?: string;
  visibility?: "default" | "public" | "private" | "confidential";
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  status: "confirmed" | "tentative" | "cancelled";
  etag?: string;
};

type GoogleEventsResponse = {
  items?: GoogleEvent[];
  nextPageToken?: string;
};

export async function listPrimaryEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<GoogleEvent[]> {
  const all: GoogleEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );
    if (res.status === 401) throw new ReauthRequiredError();
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Calendar API failed: ${res.status} ${body}`);
    }
    const data: GoogleEventsResponse = await res.json();
    for (const item of data.items ?? []) {
      if (item.status !== "cancelled") all.push(item);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return all;
}
