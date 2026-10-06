export const DURATIONS = [1, 3, 5, 10, 15, 30] as const;
export const POINTS = [100, 80, 60, 40, 20, 10] as const;
export const CATALOG_VERSION = "v2-audio-1";
export const TIME_ZONE = "Europe/Sarajevo";
export type Category = "pop" | "rock" | "folk" | "trap";
export type Pack = "mix" | Category;
export type Song = {
  id: string;
  artist: string;
  title: string;
  category: Category;
  aliases?: string[];
  artistAliases?: string[];
  deezerId?: number;
  audioUrl?: string;
  audioUnavailable?: boolean;
};
export type Guess = {
  text: string;
  kind: "wrong" | "artist" | "more" | "correct";
};
export type Round = {
  songId: string;
  attempt: number;
  status: "playing" | "won" | "lost";
  guesses: Guess[];
  points: number;
};
export type Session = {
  version: 2;
  id: string;
  day: string;
  mode: "daily" | "practice";
  pack: Pack;
  rounds: Round[];
  reserve: string[];
  replaced: string[];
  index: number;
  finished: boolean;
};
export type DailyRecord = {
  score: number;
  correct: number;
  total: number;
  replaced: boolean;
};
export type Records = Record<string, DailyRecord>;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
// Only approved aliases are accepted: stripping arbitrary suffixes would confuse remixes/covers.
export function judgeGuess(
  input: string,
  song: Song,
): "correct" | "artist" | "wrong" | "empty" {
  const guess = normalize(input);
  if (!guess) return "empty";
  const titles = [song.title, ...(song.aliases ?? [])].map(normalize);
  const artists = [song.artist, ...(song.artistAliases ?? [])].map(normalize);
  if (
    titles.some(
      (title) =>
        guess === title ||
        artists.some(
          (artist) =>
            guess === `${artist} ${title}` || guess === `${title} ${artist}`,
        ),
    )
  )
    return "correct";
  if (artists.includes(guess)) return "artist";
  return "wrong";
}

export function dayKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
export function nextReset(date = new Date()): number {
  const day = dayKey(date);
  let lo = date.getTime();
  let hi = lo + 27 * 60 * 60 * 1000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (dayKey(new Date(mid)) === day) lo = mid;
    else hi = mid;
  }
  return hi;
}
export function previousDay(day: string): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) - 86400000)
    .toISOString()
    .slice(0, 10);
}
export function streak(records: Records, today: string): number {
  let day = records[today] ? today : previousDay(today);
  let count = 0;
  while (records[day]) {
    count++;
    day = previousDay(day);
  }
  return count;
}
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let state = 2166136261;
  for (const c of seed) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const j = (state >>> 0) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function makeSession(
  songs: Song[],
  mode: Session["mode"],
  day: string,
  pack: Pack = "mix",
  seed = "",
): Session {
  const id =
    mode === "daily" ? `daily:${CATALOG_VERSION}:${day}` : `practice:${seed}`;
  const pool = seededShuffle(
    songs.filter((s) => pack === "mix" || s.category === pack),
    id,
  );
  const selected: Song[] = [];
  // A daily mix starts with genre variety; unique artists are preferred throughout.
  if (pack === "mix")
    for (const category of ["pop", "rock", "folk", "trap"]) {
      const song = pool.find(
        (s) =>
          s.category === category &&
          !selected.some((p) => p.artist === s.artist),
      );
      if (song) selected.push(song);
    }
  for (const song of pool) {
    if (selected.length >= 5) break;
    if (!selected.some((s) => s.artist === song.artist)) selected.push(song);
  }
  for (const song of pool) {
    if (selected.length >= 5) break;
    if (!selected.some((s) => s.id === song.id)) selected.push(song);
  }
  const ordered = seededShuffle(selected, `${id}:order`);
  return {
    version: 2,
    id,
    day,
    mode,
    pack,
    rounds: ordered.map((song) => ({
      songId: song.id,
      attempt: 0,
      status: "playing",
      guesses: [],
      points: 0,
    })),
    reserve: pool
      .filter((s) => !selected.some((p) => p.id === s.id))
      .map((s) => s.id),
    replaced: [],
    index: 0,
    finished: false,
  };
}
export function submitGuess(
  session: Session,
  input: string,
  song: Song,
): { session: Session; verdict: ReturnType<typeof judgeGuess> } {
  const verdict = judgeGuess(input, song);
  const round = session.rounds[session.index];
  if (
    verdict === "empty" ||
    session.finished ||
    !round ||
    round.status !== "playing" ||
    round.songId !== song.id
  )
    return { session, verdict };
  const next: Round = {
    ...round,
    guesses: [
      ...round.guesses,
      {
        text: input.trim(),
        kind:
          verdict === "correct"
            ? "correct"
            : verdict === "artist"
              ? "artist"
              : "wrong",
      },
    ],
  };
  if (verdict === "correct") {
    next.status = "won";
    next.points = POINTS[round.attempt];
  } else if (round.attempt === DURATIONS.length - 1) next.status = "lost";
  else next.attempt++;
  return {
    session: {
      ...session,
      rounds: session.rounds.map((r, i) => (i === session.index ? next : r)),
    },
    verdict,
  };
}
export function moreAudio(session: Session): Session {
  const round = session.rounds[session.index];
  if (session.finished || round.status !== "playing") return session;
  const next: Round = {
    ...round,
    guesses: [...round.guesses, { text: "Slušaj više", kind: "more" }],
  };
  if (round.attempt === DURATIONS.length - 1) next.status = "lost";
  else next.attempt++;
  return {
    ...session,
    rounds: session.rounds.map((r, i) => (i === session.index ? next : r)),
  };
}
export function advance(session: Session): Session {
  if (session.finished || session.rounds[session.index].status === "playing")
    return session;
  if (session.index === session.rounds.length - 1)
    return { ...session, finished: true };
  return { ...session, index: session.index + 1 };
}
export function replaceUnavailable(session: Session): Session {
  const round = session.rounds[session.index];
  if (round.status !== "playing" || !session.reserve.length || session.finished)
    return session;
  const [songId, ...reserve] = session.reserve;
  return {
    ...session,
    reserve,
    replaced: [...session.replaced, round.songId],
    rounds: session.rounds.map((r, i) =>
      i === session.index
        ? { songId, attempt: 0, status: "playing", guesses: [], points: 0 }
        : r,
    ),
  };
}
export function totalScore(session: Session): number {
  return session.rounds.reduce((sum, r) => sum + r.points, 0);
}

export function parseSession(
  raw: string | null,
  songs: Song[],
  expectedId?: string,
): Session | null {
  try {
    const s = JSON.parse(raw ?? "null") as Session;
    const ids = new Set(songs.map((song) => song.id));
    if (
      !s ||
      s.version !== 2 ||
      typeof s.id !== "string" ||
      (expectedId && s.id !== expectedId) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(s.day) ||
      !["daily", "practice"].includes(s.mode) ||
      !["mix", "pop", "rock", "folk", "trap"].includes(s.pack)
    )
      return null;
    if (
      !Array.isArray(s.rounds) ||
      s.rounds.length < 1 ||
      s.rounds.length > 5 ||
      !Number.isInteger(s.index) ||
      s.index < 0 ||
      s.index >= s.rounds.length ||
      typeof s.finished !== "boolean"
    )
      return null;
    if (
      !Array.isArray(s.reserve) ||
      !s.reserve.every((id) => ids.has(id)) ||
      !Array.isArray(s.replaced) ||
      !s.replaced.every((id) => ids.has(id))
    )
      return null;
    if (
      new Set([...s.rounds.map((r) => r.songId), ...s.reserve, ...s.replaced])
        .size !==
      s.rounds.length + s.reserve.length + s.replaced.length
    )
      return null;
    for (const [index, r] of s.rounds.entries()) {
      if (
        !ids.has(r.songId) ||
        !Number.isInteger(r.attempt) ||
        r.attempt < 0 ||
        r.attempt >= DURATIONS.length ||
        !["playing", "won", "lost"].includes(r.status)
      )
        return null;
      if (
        !Array.isArray(r.guesses) ||
        r.guesses.length > 6 ||
        !r.guesses.every(
          (g) =>
            g &&
            typeof g.text === "string" &&
            g.text.length <= 240 &&
            ["wrong", "artist", "more", "correct"].includes(g.kind),
        )
      )
        return null;
      if (r.points !== (r.status === "won" ? POINTS[r.attempt] : 0))
        return null;
      if (
        (index < s.index && r.status === "playing") ||
        (index > s.index && (r.status !== "playing" || r.guesses.length !== 0))
      )
        return null;
    }
    if (
      s.finished &&
      (s.index !== s.rounds.length - 1 ||
        s.rounds.some((r) => r.status === "playing"))
    )
      return null;
    return s;
  } catch {
    return null;
  }
}
export function parseRecords(raw: string | null): Records {
  try {
    const records = JSON.parse(raw ?? "{}");
    if (!records || typeof records !== "object" || Array.isArray(records))
      return {};
    return Object.fromEntries(
      Object.entries(records)
        .filter(([day, value]) => {
          const r = value as DailyRecord;
          return (
            /^\d{4}-\d{2}-\d{2}$/.test(day) &&
            r &&
            Number.isInteger(r.total) &&
            r.total > 0 &&
            r.total <= 5 &&
            Number.isInteger(r.score) &&
            r.score >= 0 &&
            r.score <= r.total * 100 &&
            Number.isInteger(r.correct) &&
            r.correct >= 0 &&
            r.correct <= r.total &&
            typeof r.replaced === "boolean"
          );
        })
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 365),
    ) as Records;
  } catch {
    return {};
  }
}
