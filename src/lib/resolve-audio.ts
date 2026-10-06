import { matchTrack, safePreview, type ProviderTrack } from "./audio";
import type { Song } from "./game";

export type AudioData = {
  url: string;
  image: string | null;
  source: string | null;
};

// Search only when a recording has not yet been pinned in the catalog.
// Keep signed preview URLs fresh: caching them for an hour can outlive the link.
export async function resolveAudio(
  song: Song,
  fetcher: typeof fetch = fetch,
): Promise<AudioData | null> {
  if (song.audioUrl) {
    if (new URL(song.audioUrl).protocol !== "https:")
      throw new Error("Invalid catalog audio URL");
    return { url: song.audioUrl, image: null, source: null };
  }
  const queries = [
    `artist:"${song.artist}" track:"${song.title}"`,
    `${song.artist} ${song.title}`,
  ];
  const endpoints = song.deezerId
    ? [`https://api.deezer.com/track/${song.deezerId}`]
    : queries.map(
        (q) =>
          `https://api.deezer.com/search?${new URLSearchParams({ q, limit: "25" })}`,
      );
  const signal = AbortSignal.timeout(10000);
  for (const endpoint of endpoints) {
    const response = await fetcher(endpoint, { cache: "no-store", signal });
    if (!response.ok) throw new Error(`Audio provider HTTP ${response.status}`);
    const body = await response.json();
    // Deezer can return an API error inside a successful HTTP response.
    // This is a provider outage, not evidence that the song has no preview.
    if (body.error) throw new Error("Audio provider error");
    const candidates: ProviderTrack[] = song.deezerId
      ? [body]
      : Array.isArray(body.data)
        ? body.data
        : [];
    const track = candidates.find(
      (candidate) =>
        Number.isSafeInteger(candidate?.id) &&
        matchTrack(song, candidate) &&
        safePreview(candidate.preview!),
    );
    if (track) {
      const image = track.album?.cover_medium;
      return {
        url: track.preview!,
        image: image && safePreview(image) ? image : null,
        source: `https://www.deezer.com/track/${track.id}`,
      };
    }
  }
  return null;
}
