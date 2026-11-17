// Who is on each PC right now, from GET /api/stores/{id}/clients/active.
// Used to warn on the Restart / Shutdown confirmation when the PC has an active visit.

export type ClientVisitsRequest = {
  source: "netconsole";
  type: "client-visits";
  id: string;
  // The client's name as eplay shows it, e.g. "RZ02-G" or "PS03".
  client: string;
};

export type ClientVisitsResult = {
  source: "netconsole";
  type: "client-visits-done";
  id: string;
  client: string;
  // One label per active visit, e.g. "SERVICE OPERATOR 1 (Service Operator)".
  users: string[];
  // False when the fresh request failed and the last loaded list was used instead.
  fresh: boolean;
  // True when no list was available at all, so we can't say.
  unknown?: boolean;
};

type Customer = { full_name?: unknown; username?: unknown };
type Visit = { terminated_at?: unknown; account?: { customer?: Customer } };
type Client = { name?: unknown; current_visits?: unknown };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function userLabel(visit: Visit): string {
  const customer = visit.account?.customer;
  const name = text(customer?.full_name);
  const username = text(customer?.username);
  // Guest accounts are "ANONYMOUS ANONYMOUS-123…" / "Anonymous-123…": the username says it all.
  if (username && /^anonymous\b/i.test(name)) return username;
  if (name && username && !name.toLowerCase().includes(username.toLowerCase())) return `${name} (${username})`;
  return name || username || "Unknown user";
}

export function usersByClient(body: unknown): Map<string, string[]> {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
      ? (body as { data: unknown[] }).data
      : [];
  const result = new Map<string, string[]>();
  for (const item of list) {
    const client = item as Client | null;
    const name = text(client?.name);
    if (!name) continue;
    const visits = Array.isArray(client?.current_visits) ? (client.current_visits as Visit[]) : [];
    result.set(
      name,
      visits.filter((visit) => visit && !visit.terminated_at).map(userLabel),
    );
  }
  return result;
}
