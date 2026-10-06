import { normalize, type Song } from "./game";
export type ProviderTrack = {
  id: number;
  title: string;
  preview?: string;
  readable?: boolean;
  artist: { name: string };
  album?: { cover_medium?: string };
  link?: string;
};
export function matchTrack(song: Song, track: ProviderTrack): boolean {
  if (
    !track?.artist?.name ||
    !track.title ||
    !track.preview ||
    track.readable === false
  )
    return false;
  const artists = [song.artist, ...(song.artistAliases ?? [])].map(normalize);
  const titles = [song.title, ...(song.aliases ?? [])].map(normalize);
  return (
    artists.includes(normalize(track.artist.name)) &&
    titles.includes(normalize(track.title))
  );
}
export function safePreview(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "dzcdn.net" ||
        parsed.hostname.endsWith(".dzcdn.net"))
    );
  } catch {
    return false;
  }
}
