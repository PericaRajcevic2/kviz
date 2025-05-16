import { NextResponse } from "next/server";

const balkanArtists = [
  "Seka Aleksić",
  "Šaban Šaulić",
  "Severina",
  "Željko Joksimović",
  "Ceca",
  "Bajaga",
  "Dino Merlin",
  "Tose Proeski",
  "Mile Kitić",
  "Jelena Karleuša",
];

const allowedArtistsSet = new Set(balkanArtists.map((a) => a.toLowerCase()));

// Fetch pjesme po izvođaču s Deezer public API
async function fetchTracksByArtist(artist: string) {
  const url = `https://api.deezer.com/search?q=artist:"${encodeURIComponent(artist)}"&limit=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Deezer API error");
  const json = await res.json();
  return json.data;
}

export async function GET() {
  try {
    // Povuci pjesme od svakog izvođača
    const promises = balkanArtists.map(fetchTracksByArtist);
    const results = await Promise.all(promises);

    // Spoji sve pjesme u jedan niz, filtriraj preview_url i samo dozvoljene izvođače
    const allTracks = results
      .flat()
      .filter(
        (t) =>
          t.preview !== null &&
          allowedArtistsSet.has(t.artist.name.toLowerCase())
      );

    console.log(`Ukupno pjesama dohvaćeno: ${results.flat().length}`);
    console.log(`Pjesama s preview linkom i pravim izvođačem: ${allTracks.length}`);

    // Mapiraj u oblik koji frontend očekuje
    const tracks = allTracks.map((t) => ({
      name: t.title,
      artist: t.artist.name,
      preview_url: t.preview,
      album_image: t.album.cover_medium,
    }));

    // Nasumično promiješaj i uzmi prvih 20 pjesama za igru
    const shuffled = tracks.sort(() => 0.5 - Math.random()).slice(0, 20);

    return NextResponse.json(shuffled);
  } catch (e) {
    console.error("Greška u Deezer API pozivu:", e);
    return NextResponse.json(
      { error: "Ne mogu dohvatiti pjesme s Deezer-a." },
      { status: 500 }
    );
  }
}
