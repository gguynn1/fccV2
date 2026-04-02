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
