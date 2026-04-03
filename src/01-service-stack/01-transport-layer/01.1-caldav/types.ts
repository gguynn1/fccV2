import { z } from "zod";

export interface CalDAVEvent {
  uid: string;
  summary: string;
  dtstart: Date;
  dtend?: Date;
  location?: string;
  description?: string;
  source_event_id: string;
}

export interface CalDAVCalendar {
  path: string;
  display_name: string;
  events: CalDAVEvent[];
}

export interface CalDAVCollectionMetadata {
  display_name: string;
  description: string;
  timezone: string;
  ctag: string;
}

export interface VEventPayload {
  uid: string;
  dtstamp: Date;
  dtstart: Date;
  dtend?: Date;
  summary: string;
  description?: string;
  location?: string;
}

export interface VCalendarPayload {
  prodid: string;
  version: "2.0";
  events: VEventPayload[];
}

export const calDavQuerySchema = z.object({
  "calendar-query": z.unknown().optional(),
  "calendar-multiget": z.unknown().optional(),
});
