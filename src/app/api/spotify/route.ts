import { NextResponse } from "next/server";

const DEEZER_API_URL = "https://api.deezer.com";

interface DeezerTrack {
  id: number;
  title: string;
  preview: string;
  artist: {
    name: string;
  };
  album: {
    cover_medium: string;
  };
}

// List of popular Balkan artists and their songs
const BALKAN_TRACKS = [
  { artist: "Dino Merlin", title: "Sve je laža" },
  { artist: "Zdravko Čolić", title: "Ti si mi u krvi" },
  { artist: "Bijelo Dugme", title: "Ako ima boga" },
  { artist: "Ceca", title: "Kukavica" },
  { artist: "Severina", title: "Moj je život moja stvar" },
  { artist: "Jelena Rozga", title: "Oprosti mala" },
  { artist: "Halid Bešlić", title: "Miljacka" },
  { artist: "Seka Aleksić", title: "Bomba" },
  { artist: "Mile Kitić", title: "Oči boje meda" },
  { artist: "Lepa Brena", title: "Jugoslovenka" },
  { artist: "Dragana Mirković", title: "Ostani" },
  { artist: "Zeljko Joksimovic", title: "Lane moje" },
  { artist: "Marija Šerifović", title: "Molitva" },
  { artist: "Željko Samardžić", title: "Sve bih dao" },
  { artist: "Dino Merlin", title: "Supermen" },
  { artist: "Zdravko Čolić", title: "Zagrli me" },
  { artist: "Bijelo Dugme", title: "Lična karta" },
  { artist: "Ceca", title: "Nevaljala" },
  { artist: "Severina", title: "Gas Gas" },
  { artist: "Jelena Rozga", title: "Bižuterija" },
  { artist: "Halid Bešlić", title: "Romanija" },
  { artist: "Seka Aleksić", title: "Sve bih dala" },
  { artist: "Mile Kitić", title: "Sve bih dao" },
  { artist: "Lepa Brena", title: "Čačak, Čačak" },
  { artist: "Dragana Mirković", title: "Sve bih dala" },
  { artist: "Zeljko Joksimovic", title: "Nije ljubav stvar" },
  { artist: "Marija Šerifović", title: "Nisam anđeo" },
  { artist: "Željko Samardžić", title: "Sve bih dao" },
  { artist: "Dino Merlin", title: "Burek" },
  { artist: "Zdravko Čolić", title: "Ti si mi u krvi" }
];

function getCurrentDay() {
  const days = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];
  return days[new Date().getDay()];
}

// Deterministic shuffle using a seed (date string)
function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getTodaySeed() {
  const now = new Date();
  // Use YYYYMMDD as seed
  return parseInt(`${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`);
}

async function searchTrack(artist: string, title: string): Promise<DeezerTrack | null> {
  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const response = await fetch(`${DEEZER_API_URL}/search?q=${query}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.data && data.data.length > 0) {
      const track = data.data[0];
      if (track.preview) {
        return track;
      }
    }
    return null;
  } catch (error) {
    console.error(`Error searching for ${artist} - ${title}:`, error);
    return null;
  }
}

export async function GET() {
  try {
    // Deterministically shuffle the tracks array based on today's date
    const todaySeed = getTodaySeed();
    const shuffledTracks = seededShuffle(BALKAN_TRACKS, todaySeed);
    // Try to find 5 tracks with previews (no attempt limit, just go through the list)
    const tracks: DeezerTrack[] = [];
    for (const track of shuffledTracks) {
      if (tracks.length >= 5) break;
      const foundTrack = await searchTrack(track.artist, track.title);
      if (foundTrack && foundTrack.preview) {
        tracks.push(foundTrack);
      }
    }

    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "Nema dostupnih pjesama za današnji dan." },
        { status: 404 }
      );
    }

    const responseTracks = tracks.map((t) => ({
      name: t.title,
      artist: t.artist.name,
      preview_url: t.preview,
      album_image: t.album.cover_medium,
      spotify_id: t.id.toString()
    }));

    return NextResponse.json({
      tracks: responseTracks,
      day: getCurrentDay(),
      cooldownUntil: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
    });
  } catch (e: any) {
    console.error("Greška u API pozivu:", e);
    return NextResponse.json(
      { error: "Došlo je do greške pri dohvatu pjesama.", details: e?.message || e?.toString() },
      { status: 500 }
    );
  }
}