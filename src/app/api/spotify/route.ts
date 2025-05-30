import { NextResponse } from "next/server";

// Definirani izvođači i pjesme po danima
const WEEKLY_TRACKS = {
  ponedjeljak: [
    { artist: "Tatjana Matejaš Tajči", title: "Hajde da ludujemo" },
    { artist: "Žera & Crvena Jabuka", title: "Bježi kišo s prozora" },
    { artist: "Bojan Marović", title: "Tebi je lako" },
    { artist: "Tanja Savić", title: "Gde ljubav putuje" },
    { artist: "Kaliopi", title: "Crno i belo" }
  ],
  utorak: [
    { artist: "Sergej Ćetković", title: "Pogledi u tami" },
    { artist: "Lana Jurčević", title: "Ludo ljeto" },
    { artist: "Mile Kitić", title: "Kraljica trotoara" },
    { artist: "Amel Ćurić", title: "Neizlečivo" },
    { artist: "Ivana Banfić", title: "Godinama" }
  ],
  srijeda: [
    { artist: "Danijela Martinović", title: "Zovem te ja" },
    { artist: "Miroslav Ilić", title: "Voleo sam devojku iz grada" },
    { artist: "Aleksandra Prijović", title: "Legitimno" },
    { artist: "Đorđe Balašević", title: "Devojka sa čardaš nogama" },
    { artist: "Hari Varešanović", title: "Strah me da te volim" }
  ],
  četvrtak: [
    { artist: "Indira Forza", title: "Dođi" },
    { artist: "Aca Lukas", title: "Ovo je istina" },
    { artist: "Danijela Štajnfeld", title: "Nikada" },
    { artist: "Seka Aleksić", title: "Aspirin" },
    { artist: "Žanamari", title: "Ljubav" }
  ],
  petak: [
    { artist: "Miroslav Škoro", title: "Ne dirajte mi ravnicu" },
    { artist: "Miach", title: "Iluzija" },
    { artist: "Boris Novković", title: "U dobru i zlu" },
    { artist: "Lidija Bačić", title: "Solo" },
    { artist: "Elitni Odredi", title: "Kao kokain" }
  ],
  subota: [
    { artist: "Meri Cetinić", title: "U prolazu" },
    { artist: "Balkanika", title: "Nova deca" },
    { artist: "Tanja Banjanin", title: "Moja stvar" },
    { artist: "Gazda Paja", title: "Otrovan" },
    { artist: "Massimo Savić", title: "Iz jednog pogleda" }
  ],
  nedjelja: [
    { artist: "Oliver Dragojević", title: "Pismo moja" },
    { artist: "Dado Polumenta", title: "Moja srno" },
    { artist: "Maya Berović", title: "Leti ptico slobodno" },
    { artist: "Knez", title: "Balkan" },
    { artist: "Jala Brat", title: "Stari radio" }
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