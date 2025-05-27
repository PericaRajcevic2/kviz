import { NextResponse } from "next/server";

// Definirani izvođači i pjesme po danima
const WEEKLY_TRACKS = {
  ponedjeljak: [
    { artist: "Severina", title: "Daleko ti kuća" },
    { artist: "Dino Merlin", title: "Hotel Nacional" },
    { artist: "Zdravko Čolić", title: "Manijači" },
    { artist: "Nina Badrić", title: "Rekao si" },
    { artist: "Prljavo Kazalište", title: "Mojoj majci" }
  ],
  utorak: [
    { artist: "Tony Cetinski", title: "Kao u snu" },
    { artist: "Jelena Rozga", title: "Bižuterija" },
    { artist: "Hari Mata Hari", title: "Lejla" },
    { artist: "Željko Joksimović", title: "Ljubavi" },
    { artist: "Magazin", title: "Ginem" }
  ],
  srijeda: [
    { artist: "Bajaga", title: "Moji drugovi" },
    { artist: "Colonia", title: "Sexy body" },
    { artist: "Marija Šerifović", title: "Pametna i luda" },
    { artist: "Gibonni", title: "Mirakul" },
    { artist: "Lexington Band", title: "Donesi" }
  ],
  četvrtak: [
    { artist: "Željko Samardžić", title: "Sipajte mi još jedan viski" },
    { artist: "Van Gogh", title: "Neko te ima" },
    { artist: "Crvena Jabuka", title: "Tamo gdje ljubav počinje" },
    { artist: "Lepa Brena", title: "Luda za tobom" },
    { artist: "Halid Bešlić", title: "Miljacka" }
  ],
  petak: [
    { artist: "Maja Berović", title: "Zvezde" },
    { artist: "Saša Kovačević", title: "Temperatura" },
    { artist: "Aleksandra Radović", title: "Čuvaj moje srce" },
    { artist: "Petar Grašo", title: "Ako te pitaju" },
    { artist: "Plavi orkestar", title: "Suada" }
  ],
  subota: [
    { artist: "Neda Ukraden", title: "Zora je" },
    { artist: "Željko Bebek", title: "Da je sreće bilo" },
    { artist: "Ana Nikolić", title: "Romale romali" },
    { artist: "Joksimović & Dino Merlin", title: "Supermen" },
    { artist: "Tropico Band", title: "Zauvek tvoj" }
  ],
  nedjelja: [
    { artist: "Riblja Čorba", title: "Lutka sa naslovne strane" },
    { artist: "Al Dino", title: "Kopriva" },
    { artist: "Indira Radić", title: "Lopov" },
    { artist: "Dženan Lončarević", title: "Nikome ni reč" },
    { artist: "Miligram", title: "Vrati mi se nesrećo" }
  ]
};

interface DeezerTrack {
  id: number;
  title: string;
  preview: string | null;
  artist: { name: string };
  album: { cover_medium: string };
}

async function fetchTrackDetails(artist: string, title: string): Promise<DeezerTrack | null> {
  const url = `https://api.deezer.com/search?q=artist:"${encodeURIComponent(artist)}" track:"${encodeURIComponent(title)}"`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.[0] || null;
  } catch (e) {
    console.error(`Greška pri dohvatu pjesme ${title} - ${artist}:`, e);
    return null;
  }
}

function getCurrentDay() {
  const days = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];

  return days[new Date().getDay()];
}

export async function GET() {
  try {
    const currentDay = getCurrentDay();
    const dailyTracks = WEEKLY_TRACKS[currentDay as keyof typeof WEEKLY_TRACKS] || [];

    // Dohvati detalje za svaku pjesmu
    const trackDetails = await Promise.all(
      dailyTracks.map(track => fetchTrackDetails(track.artist, track.title))
    );

    const validTracks = trackDetails.filter(t => t !== null) as DeezerTrack[];

    if (validTracks.length === 0) {
      return NextResponse.json(
        { error: "Nema dostupnih pjesama za današnji dan." },
        { status: 404 }
      );
    }

    const responseTracks = validTracks.map((t) => ({
      name: t.title,
      artist: t.artist.name,
      preview_url: t.preview,
      album_image: t.album.cover_medium,
    }));

    return NextResponse.json({
      tracks: responseTracks,
      day: currentDay,
      cooldownUntil: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
    });
  } catch (e) {
    console.error("Greška u API pozivu:", e);
    return NextResponse.json(
      { error: "Došlo je do greške pri dohvatu pjesama." },
      { status: 500 }
    );
  }
}