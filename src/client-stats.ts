export type ClientKind = {
  key: string;
  label: string;
  icon: string;
  total: number;
  busy: number;
  broken: number;
};

export type ClientStatsMessage = {
  source: "netconsole";
  type: "clients";
  kinds: ClientKind[];
};

type ClientRecord = {
  type?: unknown;
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

// PCs share one label. Other kinds take their group name, e.g. "PS5" or "Ping - Pong".
function describe(type: string, groups: string[]): { label: string; icon: string } {
  const group = groups[0] ?? "";
  if (type === "PC") return { label: "PCs", icon: "mdi-monitor" };
  if (/ping|pong|table/i.test(group)) return { label: "Ping pong", icon: "mdi-table-tennis" };
  if (/ps\d|playstation/i.test(group)) return { label: group, icon: "mdi-sony-playstation" };
  if (type === "CONSOLE") return { label: group || "Consoles", icon: "mdi-gamepad-variant" };
  return { label: group || "Other", icon: "mdi-shape-outline" };
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
      kind = { key, ...describe(type, groups), total: 0, busy: 0, broken: 0 };
      kinds.set(key, kind);
    }
    kind.total += 1;
    if (client.faulty === true || (client.defect !== null && client.defect !== undefined)) kind.broken += 1;
    else if (Array.isArray(client.current_visits) && client.current_visits.length > 0) kind.busy += 1;
  }

  const rank = (key: string) => {
    const index = order.indexOf(key.split(":")[0]);
    return index === -1 ? order.length : index;
  };
  return [...kinds.values()].sort((a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label));
}
