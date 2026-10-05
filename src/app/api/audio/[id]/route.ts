import { NextRequest, NextResponse } from "next/server";
import { songById } from "@/lib/catalog";
import { matchTrack, safePreview, type ProviderTrack } from "@/lib/audio";
export const maxDuration = 15;
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const song = songById.get(id);
  if (!song)
    return NextResponse.json({ error: "Nepoznata pjesma." }, { status: 404 });
  // This adapter can be replaced with licensed, self-hosted excerpts without changing the game.
  if (song.audioUrl)
    return NextResponse.json({ url: song.audioUrl, image: null, source: null });
  try {
    const query = `artist:"${song.artist}" track:"${song.title}"`;
    const endpoint = song.deezerId
      ? `https://api.deezer.com/track/${song.deezerId}`
      : `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=15`;
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(8000),
      ...(refresh
        ? { cache: "no-store" as const }
        : { next: { revalidate: 3600 } }),
    });
    if (!res.ok) throw new Error("provider");
    const data = await res.json();
    const candidates: ProviderTrack[] = song.deezerId
      ? [data]
      : Array.isArray(data.data)
        ? data.data
        : [];
    const track = candidates.find(
      (track) => matchTrack(song, track) && safePreview(track.preview!),
    );
    if (!track)
      return NextResponse.json(
        { error: "Za ovu pjesmu trenutno nema odgovarajućeg audioisječka." },
        { status: 404 },
      );
    const image = track.album?.cover_medium;
    return NextResponse.json(
      {
        url: track.preview,
        image: image && safePreview(image) ? image : null,
        source: `https://www.deezer.com/track/${track.id}`,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Audio se trenutno ne može učitati. Pokušaj ponovo ili zamijeni pjesmu bez gubitka bodova.",
      },
      { status: 503, headers: { "Retry-After": "10" } },
    );
  }
}
