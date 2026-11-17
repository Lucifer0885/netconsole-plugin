export type ClientKind = {
  key: string;
  label: string;
  icon: string;
  // What total / busy / broken count, for the tooltip: "PCs", "consoles", "tables".
  unit: string;
  total: number;
  busy: number;
  broken: number;
  // People playing right now (open visits) and the seats they can take.
  players: number;
  seats: number;
  // Set for ping pong, where one client in eplay stands for several tables.
  seatsPerTable?: number;
};

export type ClientStatsMessage = {
  source: "netconsole";
  type: "clients";
  kinds: ClientKind[];
};

type ClientRecord = {
  type?: unknown;
  slots?: unknown;
  faulty?: unknown;
  defect?: unknown;
  current_visits?: unknown;
  client_groups?: { name?: unknown }[];
};

const order = ["PC", "CONSOLE", "OTHER"];

export function isClientListUrl(url: string): boolean {
  try {
    const path = new URL(url, "https://eplay.netconsole.me").pathname;
    return /\/api\/stores\/\d+\/clients\/active$/.test(path);
  } catch {
    return false;
  }
}

// The store's ping pong client has 4 seats for its 2 tables, 2 players per table.
const pingPongSeatsPerTable = 2;

type Description = { label: string; icon: string; unit: string; seatsPerTable?: number };

// PCs share one label. Other kinds take their group name, e.g. "PS5" or "Ping - Pong".
function describe(type: string, groups: string[]): Description {
  const group = groups[0] ?? "";
  if (type === "PC") return { label: "PCs", icon: "mdi-monitor", unit: "PCs" };
  if (/ping|pong|table/i.test(group)) {
    return { label: "Ping pong", icon: "mdi-table-tennis", unit: "tables", seatsPerTable: pingPongSeatsPerTable };
  }
  if (/ps\d|playstation/i.test(group)) return { label: group, icon: "mdi-sony-playstation", unit: "consoles" };
  if (type === "CONSOLE") return { label: group || "Consoles", icon: "mdi-gamepad-variant", unit: "consoles" };
  return { label: group || "Other", icon: "mdi-shape-outline", unit: "clients" };
}

function groupNames(client: ClientRecord): string[] {
  if (!Array.isArray(client.client_groups)) return [];
  return client.client_groups
    .map((group) => (typeof group?.name === "string" ? group.name.trim() : ""))
    .filter(Boolean);
}

export function kindsFromClients(body: unknown): ClientKind[] | null {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
      ? (body as { data: unknown[] }).data
      : null;
  if (!list) return null;

  const kinds = new Map<string, ClientKind>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const client = item as ClientRecord;
    const type = typeof client.type === "string" ? client.type : "OTHER";
    const groups = groupNames(client);
    const key = type === "PC" ? type : `${type}:${groups[0] ?? ""}`;
    let kind = kinds.get(key);
    if (!kind) {
      kind = { key, ...describe(type, groups), total: 0, busy: 0, broken: 0, players: 0, seats: 0 };
      kinds.set(key, kind);
    }
    const slots = typeof client.slots === "number" && client.slots > 0 ? client.slots : 1;
    const visits = Array.isArray(client.current_visits) ? client.current_visits.length : 0;
    const broken = client.faulty === true || (client.defect !== null && client.defect !== undefined);
    kind.players += visits;
    kind.seats += slots;

    if (kind.seatsPerTable) {
      // One client, several tables: 2 tables for 4 seats. A table is taken as soon as someone
      // plays on it, so 1-2 visits take one table and 3-4 take both.
      const tables = Math.max(1, Math.round(slots / kind.seatsPerTable));
      kind.total += tables;
      if (broken) kind.broken += tables;
      else kind.busy += Math.min(tables, Math.ceil(visits / kind.seatsPerTable));
      continue;
    }

    kind.total += 1;
    if (broken) kind.broken += 1;
    else if (visits > 0) kind.busy += 1;
  }

  const rank = (key: string) => {
    const index = order.indexOf(key.split(":")[0]);
    return index === -1 ? order.length : index;
  };
  return [...kinds.values()].sort((a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label));
}
