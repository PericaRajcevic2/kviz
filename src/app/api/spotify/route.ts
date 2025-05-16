import { NextResponse } from "next/server";

const balkanArtists = [
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

const allowedArtistsSet = new Set(balkanArtists.map((a) => a.toLowerCase()));

async function fetchTracksByArtist(artist: string) {
  const url = `https://api.deezer.com/search?q=artist:"${encodeURIComponent(artist)}"&limit=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Deezer API error");
  const json = await res.json();
  return json.data;
}

export async function GET() {
  try {
    const promises = balkanArtists.map(fetchTracksByArtist);
    const results = await Promise.all(promises);

    const allTracks = results
      .flat()
      .filter(
        (t) =>
          t.preview !== null &&
          allowedArtistsSet.has(t.artist.name.toLowerCase())
      );

    const tracks = allTracks.map((t) => ({
      name: t.title,
      artist: t.artist.name,
      preview_url: t.preview,
      album_image: t.album.cover_medium,
    }));

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
