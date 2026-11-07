export type VisitNoteMessage = {
  source: "netconsole";
  type: "visit";
  id: string;
  notes: string[];
};

type NoteRecord = {
  note_description?: unknown;
  lifted_at?: unknown;
};

type VisitBody = {
  note_description?: unknown;
  account?: {
    customer?: {
      active_notes?: NoteRecord[];
    };
  };
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
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function fromRecord(body: VisitBody): string[] {
  const notes: string[] = [];
  const own = text(body.note_description);
  if (own) notes.push(own);
  const active = body.account?.customer?.active_notes;
  if (!Array.isArray(active)) return notes;
  for (const note of active) {
    if (!note || typeof note !== "object" || note.lifted_at) continue;
    const description = text(note.note_description);
    if (description && !notes.includes(description)) notes.push(description);
  }
  return notes;
}

export function notesFromVisit(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const record = body as VisitBody;
  const notes = fromRecord(record);
  if (notes.length || !record.data || typeof record.data !== "object") return notes;
  return fromRecord(record.data);
}
