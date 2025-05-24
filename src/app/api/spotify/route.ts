import { NextResponse } from "next/server";

// Definirani izvođači i pjesme po danima
const WEEKLY_TRACKS = {
  ponedjeljak: [
    { artist: "Ceca", title: "Kukavica" },
    { artist: "Dino Merlin", title: "Sve je laž" },
    { artist: "Severina", title: "Mrtav bez mene" },
    { artist: "Željko Joksimović", title: "Lane moje" },
    { artist: "Lepa Brena", title: "Čačak, Čačak" }
  ],
  utorak: [
    { artist: "Seka Aleksić", title: "Aspirin" },
    { artist: "Šaban Šaulić", title: "Dajte mi utjehu" },
    { artist: "Zdravko Čolić", title: "Ti si mi u krvi" },
    { artist: "Bijelo Dugme", title: "Đurđevdan" },
    { artist: "Hari Mata Hari", title: "Strah me da te volim" }
  ],
  srijeda: [
    { artist: "Toše Proeski", title: "Pratim te" },
    { artist: "Mile Kitić", title: "Kilo dole kilo gore" },
    { artist: "Jelena Karleuša", title: "Insomnia" },
    { artist: "Goran Bregović", title: "Kalašnjikov" },
    { artist: "Bijelo Dugme", title: "Ružica si bila" }
  ],
  četvrtak: [
    { artist: "Zdravko Čolić", title: "Stanica Podlugovi" },
    { artist: "Lepa Brena", title: "Jugoslovenka" },
    { artist: "Hari Mata Hari", title: "Lejla" },
    { artist: "Amira Medunjanin", title: "Ajde Jano" },
    { artist: "Đorđe Balašević", title: "Priča o Vasi Ladačkom" }
  ],
  petak: [
    { artist: "Tropico Band", title: "Sve moje zore" },
    { artist: "Sejo Kalač", title: "Baš je dobro vidjeti te opet" },
    { artist: "Haris Džinović", title: "I tebe sam sit kafano" },
    { artist: "Sabrina", title: "Boys (Summertime Love)" }, // internacionalna izvođačica
    { artist: "Nataša Bekvalac", title: "Mala plava" }
  ],
  subota: [
    { artist: "Miach", title: "Led" },
    { artist: "Grše", title: "Forza" },
    { artist: "Jelena Karleuša", title: "Insomnia" },
    { artist: "Jelena Rozga", title: "Roba S Greškom" },
    { artist: "Bijelo Dugme", title: "Ružica si bila" }
  ],
  nedjelja: [
    { artist: "Marina Perazić", title: "Kolačići" },
    { artist: "Jala Brat", title: "Patek" },
    { artist: "Buba Corelli", title: "Balenciaga" },
    { artist: "Lepa Lukić", title: "Od izvora dva putića" },
    { artist: "Jelena Rozga", title: "Bižuterija" }
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