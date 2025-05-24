import { NextResponse } from "next/server";

// Definirani izvođači i pjesme po danima
const WEEKLY_TRACKS = {
  ponedjeljak: [
    { artist: "Breskvica", title: "Sava i Dunav" },
{ artist: "Jala Brat", title: "Klinka" },
{ artist: "Mia Borisavljević", title: "Nisi svestan" },
{ artist: "Relja Popović", title: "Samo jako" },
{ artist: "Teodora", title: "Drama" }
  ],
  utorak: [
    { artist: "Voyage", title: "Pleši" },
{ artist: "Rasta", title: "Adio Amore" },
{ artist: "Milica Pavlović", title: "Provereno" },
{ artist: "Sara Jo", title: "Zar ne" },
{ artist: "Nucci", title: "Crno oko" }
  ],
  srijeda: [
    { artist: "Senidah", title: "Beli svemir" },
{ artist: "Coby", title: "Rambo" },
{ artist: "Anastasija", title: "Savršen par" },
{ artist: "Maya Berović", title: "Leti" },
{ artist: "MC Stojan", title: "Salji broj" }
  ],
  četvrtak: [
    { artist: "Teya Dora", title: "Džanum" },
{ artist: "Emrah Emšo", title: "Jedina" },
{ artist: "Aleksandra Prijović", title: "Devet života" },
{ artist: "Aca Lukas", title: "Licem u lice" },
{ artist: "Inas", title: "Karmin" }
  ],
  petak: [
    { artist: "Edita", title: "Slobodno me rani" },
{ artist: "Sloba Radanović", title: "Zauvek" },
{ artist: "Igor Garnier", title: "We Let It Go" },
{ artist: "Zera", title: "Do zore" },
{ artist: "Tanja Savić", title: "Suknjica" }
  ],
  subota: [
    { artist: "Miach", title: "Anđeo" },
    { artist: "Grše", title: "Forza" },
    { artist: "Elma", title: "Ah, Tugo, Tugo" },
    { artist: "Darko Lazić", title: "Idi Drugome" },
    { artist: "Devito", title: "Svemir" }
  ],
  nedjelja: [
    { artist: "Đogani", title: "Idemo na sve" },
{ artist: "Luna Đogani", title: "Deveti krug" },
{ artist: "Bojan Tomović", title: "Puklo srce" },
{ artist: "Nikolija", title: "Loš momak" },
{ artist: "Bojana Vunturišević", title: "Money" }
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