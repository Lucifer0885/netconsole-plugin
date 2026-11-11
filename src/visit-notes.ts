// Notes for each visit, tagged with the account's names so the patch can tell which
// user card on a shared seat (a PlayStation with up to 4 players) each note belongs to.
export type VisitNoteEntry = {
  id: string;
  // The visit's own note. Undefined when the response didn't include the field
  // (the client list leaves it out), so an earlier value is kept.
  own?: string | null;
  // Active notes on the customer.
  customer: string[];
  // Full name, username, mobile: whatever the card might show for this user.
  names: string[];
};

export type VisitNoteMessage = {
  source: "netconsole";
  type: "visit-notes";
  // True when this came from a single visit response (the one the dialog just opened).
  single: boolean;
  visits: VisitNoteEntry[];
};

type NoteRecord = {
  note_description?: unknown;
  lifted_at?: unknown;
};

type Customer = {
  full_name?: unknown;
  username?: unknown;
  mobile?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  active_notes?: NoteRecord[];
};

type VisitBody = {
  id?: unknown;
  note_description?: unknown;
  account?: { customer?: Customer };
  data?: VisitBody;
};

export function visitIdFromUrl(url: string): string | null {
  try {
    const path = new URL(url, "https://eplay.netconsole.me").pathname;
    const match = path.match(/\/api\/visits\/(\d+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function text(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function customerNotes(customer: Customer | undefined): string[] {
  const notes: string[] = [];
  const active = customer?.active_notes;
  if (!Array.isArray(active)) return notes;
  for (const note of active) {
    if (!note || typeof note !== "object" || note.lifted_at) continue;
    const description = text(note.note_description);
    if (description && !notes.includes(description)) notes.push(description);
  }
  return notes;
}

// Short or generic values ("ANONYMOUS") would match every guest card, so they're left out.
function names(customer: Customer | undefined): string[] {
  if (!customer) return [];
  const first = text(customer.first_name);
  const last = text(customer.last_name);
  const all = [
    text(customer.full_name),
    first && last ? `${first} ${last}` : null,
    text(customer.username),
    text(customer.mobile),
    last,
  ];
  const unique: string[] = [];
  for (const name of all) {
    if (!name || name.length < 5 || /^anonymous$/i.test(name) || unique.includes(name)) continue;
    unique.push(name);
  }
  return unique;
}

function entry(id: string, body: VisitBody): VisitNoteEntry {
  const customer = body.account?.customer;
  const result: VisitNoteEntry = { id, customer: customerNotes(customer), names: names(customer) };
  if ("note_description" in body) result.own = text(body.note_description);
  return result;
}

// Response of GET /api/visits/{id}.
export function entryFromVisit(id: string, body: unknown): VisitNoteEntry | null {
  if (!body || typeof body !== "object") return null;
  const record = body as VisitBody;
  const visit = record.account || !record.data ? record : record.data;
  return entry(id, visit);
}

// Response of GET /api/stores/{id}/clients/active: every current visit on every seat.
export function entriesFromClients(body: unknown): VisitNoteEntry[] {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
      ? (body as { data: unknown[] }).data
      : [];
  const entries: VisitNoteEntry[] = [];
  for (const client of list) {
    const visits = (client as { current_visits?: unknown } | null)?.current_visits;
    if (!Array.isArray(visits)) continue;
    for (const visit of visits) {
      const id = text((visit as VisitBody | null)?.id);
      if (id) entries.push(entry(id, visit as VisitBody));
    }
  }
  return entries;
}
