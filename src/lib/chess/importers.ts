// Public game imports via the official Lichess and Chess.com public APIs.
export interface RemoteGame {
  id: string;
  white: string;
  black: string;
  result: string;
  date: string;
  pgn: string;
}

const clean = (u: string) => u.trim().replace(/[^A-Za-z0-9_-]/g, "");

export async function fetchLichessGames(username: string, max = 20): Promise<RemoteGame[]> {
  const u = clean(username);
  if (!u) throw new Error("Enter a Lichess username.");
  const res = await fetch(
    `https://lichess.org/api/games/user/${u}?max=${max}&pgnInJson=true&moves=true`,
    { headers: { Accept: "application/x-ndjson" } },
  );
  if (res.status === 404) throw new Error("That Lichess user wasn't found.");
  if (res.status === 429) throw new Error("Lichess is rate-limiting requests. Wait a minute and try again.");
  if (!res.ok) throw new Error(`Lichess request failed (${res.status}).`);
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((g) => g.pgn)
    .map((g) => ({
      id: g.id,
      white: g.players?.white?.user?.name ?? "Anonymous",
      black: g.players?.black?.user?.name ?? "Anonymous",
      result: g.winner === "white" ? "1-0" : g.winner === "black" ? "0-1" : "½-½",
      date: new Date(g.createdAt).toLocaleDateString(),
      pgn: g.pgn,
    }));
}

export async function fetchChessComGames(username: string, max = 20): Promise<RemoteGame[]> {
  const u = clean(username).toLowerCase();
  if (!u) throw new Error("Enter a Chess.com username.");
  const a = await fetch(`https://api.chess.com/pub/player/${u}/games/archives`);
  if (a.status === 404) throw new Error("That Chess.com user wasn't found.");
  if (!a.ok) throw new Error(`Chess.com request failed (${a.status}).`);
  const archives: string[] = (await a.json()).archives ?? [];
  const out: RemoteGame[] = [];
  for (const url of archives.reverse()) {
    if (out.length >= max) break;
    const r = await fetch(url);
    if (!r.ok) continue;
    const games: any[] = (await r.json()).games ?? [];
    for (const g of games.reverse()) {
      if (!g.pgn || g.rules !== "chess") continue;
      const wr = g.white?.result;
      out.push({
        id: g.uuid ?? g.url,
        white: g.white?.username ?? "?",
        black: g.black?.username ?? "?",
        result: wr === "win" ? "1-0" : g.black?.result === "win" ? "0-1" : "½-½",
        date: new Date((g.end_time ?? 0) * 1000).toLocaleDateString(),
        pgn: g.pgn,
      });
      if (out.length >= max) break;
    }
  }
  if (!out.length) throw new Error("No public games found for this user.");
  return out;
}
