import { NextResponse } from "next/server";

// Originalna lista izvođača (može imati duplikate)
const balkanArtistsRaw = [
  "Seka Aleksić", "Šaban Šaulić", "Severina", "Željko Joksimović", "Ceca", "Bajaga", "Dino Merlin",
  "Toše Proeski", "Mile Kitić", "Jelena Karleuša", "Goran Bregović", "Bijelo Dugme", "Zdravko Čolić",
  "Lepa Brena", "Hari Mata Hari", "Amira Medunjanin", "Đorđe Balašević", "Tropico Band", "Sejo Kalač",
  "Haris Džinović", "Sabrina", "Nataša Bekvalac", "Marko Perković Thompson", "Riblja Čorba", "Zorica Brunclik",
  "Boban Rajović", "Maja Šuša", "Marina Perazić", "Jala Brat", "Buba Corelli", "Lepa Lukić", "Jelena Rozga",
  "Aca Lukas", "Mina Kostić", "Saša Matić", "Harisu", "Toma Zdravković", "Tropico Band", "Vlatko Stefanovski",
  "Edo Maajka", "Severina Vučković", "Bajaga i Instruktori", "Ana Bekuta", "Halid Bešlić", "Sanja Ilić & Balkanika",
  "Gibonni", "Plavi Orkestar", "Kristijan Golubović", "Vesna Zmijanac", "Neda Ukraden", "Zdravko Čolić", "Halid Bešlić",
  "Vesna Zmijanac", "Viki Miljković", "Toma Zdravković", "Bajaga", "Maja Odžaklijevska", "Slavko Banjac",
  "Sanja Vučić", "Marija Šerifović", "Aleksandra Radović", "Dženan Lončarević", "Rada Manojlović", "Kaliopi",
  "Severina", "Ivan Zak", "Mitar Mirić", "Ana Nikolić", "Jelena Tomašević", "Oliver Dragojević", "Dženan Rastoder",
  "Goga Sekulić", "Nataša Džamonja", "Mirsad Kerić", "Bajaga", "Aca Pejović", "Mile Kitić", "Tose Proeski",
  "Sanja Maletić", "Marinko Rokvić", "Lepa Brena", "Sanja Vučić", "Željko Samardžić", "Dragana Mirković", "Halid Muslimović",
  "Severina Vučković", "Boban Rajović", "Sergej Ćetković", "Neda Ukraden", "Zorica Brunclik", "Goran Karan",
  "Arsen Dedić", "Vanna", "Mira Škorić", "Nada Topčagić", "Krunoslav Kićo Slabinac", "Nina Badrić", "Jinx",
  "Oliver Mandić", "Bajaga", "Čolić Zdravko", "Sanja Ilić", "Maja Blagdan", "Parni Valjak", "Dino Dvornik",
  "Tanja Savić", "Neda Ukraden", "Jelena Gavrilović", "Tropico Band", "Halid Bešlić", "Ivana Kindl",
  "Zdravko Čolić", "Bajaga", "Dino Merlin", "Jelena Karleuša", "Severina", "Željko Joksimović", "Šaban Šaulić",
  "Seka Aleksić", "Tose Proeski", "Mile Kitić", "Ceca"
];

// Dedupliciraj izvođače
const uniqueArtists = [...new Set(balkanArtistsRaw.map((a) => a.trim()))];

// Ograniči broj izvođača (npr. prvih 30)
const selectedArtists = uniqueArtists.slice(0, 30);

// Set za provjeru izvođača (lowercase)
const allowedArtistsSet = new Set(selectedArtists.map((a) => a.toLowerCase()));

interface DeezerTrack {
  id: number;
  title: string;
  preview: string | null;
  artist: {
    name: string;
  };
  album: {
    cover_medium: string;
  };
}

async function fetchTracksByArtist(artist: string): Promise<DeezerTrack[]> {
  const url = `https://api.deezer.com/search?q=artist:"${encodeURIComponent(artist)}"&limit=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Deezer API error for artist "${artist}"`);
  const json = await res.json();
  return json.data as DeezerTrack[];
}

async function fetchInBatches(
  artists: string[],
  batchSize = 5,
  delay = 500
): Promise<DeezerTrack[][]> {
  const results: DeezerTrack[][] = [];
  for (let i = 0; i < artists.length; i += batchSize) {
    const batch = artists.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fetchTracksByArtist));
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        console.error("Greška za izvođača:", result.reason);
      }
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  return results;
}

export async function GET() {
  try {
    const results = await fetchInBatches(selectedArtists);

    const allTracks = results
      .flat()
      .filter(
        (t) =>
          t.preview !== null &&
          allowedArtistsSet.has(t.artist.name.toLowerCase())
      );

    // Dedupliciraj pjesme po nazivu + izvođaču
    const uniqueTrackMap = new Map<string, DeezerTrack>();
    for (const t of allTracks) {
      const key = `${t.title.toLowerCase()}___${t.artist.name.toLowerCase()}`;
      if (!uniqueTrackMap.has(key)) {
        uniqueTrackMap.set(key, t);
      }
    }

    const deduplicatedTracks = Array.from(uniqueTrackMap.values());

    // Promiješaj i uzmi 20 pjesama
    const shuffled = deduplicatedTracks.sort(() => 0.5 - Math.random()).slice(0, 20);

    const responseTracks = shuffled.map((t) => ({
      name: t.title,
      artist: t.artist.name,
      preview_url: t.preview,
      album_image: t.album.cover_medium,
    }));

    return NextResponse.json(responseTracks);
  } catch (e) {
    console.error("Greška u Deezer API pozivu:", e);
    return NextResponse.json(
      { error: "Ne mogu dohvatiti pjesme s Deezer-a." },
      { status: 500 }
    );
  }
}

