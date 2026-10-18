import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import lichess from "@/assets/platforms/lichess.svg.asset.json";
import chesscom from "@/assets/platforms/chesscom.png.asset.json";

export type Platform = "lichess" | "chesscom";
const cache = new Map<string, string | null>();
export function PlatformLogo({ platform }: { platform: Platform }) {
  return <img src={platform === "lichess" ? lichess.url : chesscom.url} alt={platform === "lichess" ? "Lichess" : "Chess.com"} className={`h-5 w-5 shrink-0 object-contain ${platform === "lichess" ? "platform-lichess" : ""}`} />;
}
export function PlayerAvatar({ name, platform }: { name: string; platform?: Platform | undefined }) {
  const [avatar, setAvatar] = useState<string | null>(null);
  useEffect(() => {
    setAvatar(null);
    if (platform !== "chesscom" || !name || name === "?") return;
    let active = true;
    const key = name.toLowerCase();
    if (cache.has(key)) { setAvatar(cache.get(key) ?? null); return; }
    fetch(`https://api.chess.com/pub/player/${encodeURIComponent(key)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const url = typeof data?.avatar === "string" && data.avatar.startsWith("https://") ? data.avatar : null;
        cache.set(key, url);
        if (active) setAvatar(url);
      }).catch(() => {});
    return () => { active = false; };
  }, [name, platform]);
  return <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-secondary" title={name}>
    {avatar ? <img src={avatar} alt={`${name}'s profile`} className="h-full w-full object-cover" onError={() => setAvatar(null)} /> : <UserRound className="h-5 w-5 text-foreground/60" />}
  </span>;
}