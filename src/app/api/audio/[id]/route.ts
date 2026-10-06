import { NextRequest, NextResponse } from "next/server";
import { songById } from "@/lib/catalog";
import { resolveAudio } from "@/lib/resolve-audio";
export const maxDuration = 15;
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const song = songById.get(id);
  if (!song)
    return NextResponse.json(
      { error: "Nepoznata pjesma." },
      { status: 404, headers },
    );
  try {
    const data = await resolveAudio(song);
    if (!data)
      return NextResponse.json(
        { error: "Za ovu pjesmu trenutno nema odgovarajućeg audioisječka." },
        { status: 404, headers },
      );
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json(
      {
        error:
          "Audio se trenutno ne može učitati. Pokušaj ponovo ili zamijeni pjesmu bez gubitka bodova.",
      },
      { status: 503, headers: { ...headers, "Retry-After": "10" } },
    );
  }
}
