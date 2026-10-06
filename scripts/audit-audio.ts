import { readFileSync, writeFileSync } from "node:fs";
import { matchTrack, safePreview, type ProviderTrack } from "../src/lib/audio";
import type { Song } from "../src/lib/game";

const songs: Song[] = JSON.parse(
  readFileSync("src/data/songs.json", "utf8"),
).songs;
const report: unknown[] = [];
async function json(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data;
}
async function audit(song: Song) {
  try {
    const queries = [
      `artist:"${song.artist}" track:"${song.title}"`,
      `${song.artist} ${song.title}`,
    ];
    let candidates: ProviderTrack[] = [];
    let found: ProviderTrack | undefined;
    for (const q of queries) {
      const data = await json(
        `https://api.deezer.com/search?${new URLSearchParams({ q, limit: "15" })}`,
      );
      candidates = [...candidates, ...(data.data ?? [])];
      found = candidates.find(
        (t) => matchTrack(song, t) && safePreview(t.preview!),
      );
      if (found) break;
    }
    let playable = false;
    let status = 0;
    if (found) {
      const response = await fetch(found.preview!, {
        headers: { Range: "bytes=0-1023" },
        signal: AbortSignal.timeout(12000),
      });
      status = response.status;
      const reader = response.body?.getReader();
      const first = await reader?.read();
      await reader?.cancel();
      playable =
        response.ok &&
        !!first?.value?.length &&
        /audio|octet-stream/i.test(response.headers.get("content-type") ?? "");
      // Read only enough bytes to confirm this is audio; do not store excerpts.
    }
    return {
      id: song.id,
      artist: song.artist,
      title: song.title,
      playable,
      status,
      deezerId: found?.id,
      candidates: found
        ? []
        : [...new Map(candidates.map((t) => [t.id, t])).values()]
            .slice(0, 8)
            .map((t) => ({
              id: t.id,
              title: t.title,
              artist: t.artist?.name,
              preview: !!t.preview,
              readable: t.readable,
            })),
    };
  } catch (error) {
    return { id: song.id, error: String(error) };
  }
}
async function main() {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (cursor < songs.length) {
        const result = await audit(songs[cursor++]);
        report.push(result);
        console.log("AUDIO_AUDIT " + JSON.stringify(result));
      }
    }),
  );
  writeFileSync(
    "audio-audit.json",
    JSON.stringify(
      { checkedAt: new Date().toISOString(), songs: report },
      null,
      2,
    ),
  );
  console.log(`Checked ${report.length} songs.`);
}
void main();
