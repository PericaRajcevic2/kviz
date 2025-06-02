import { NextResponse } from "next/server";
import songsData from '@/data/songs.json';

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

// Function to get the week number of the year
function getWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor(diff / oneWeek);
}

function getCurrentDay() {
  const days = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];
  return days[new Date().getDay()];
}

// Deterministic shuffle using a seed (week number + day)
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
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
  const weekNumber = getWeekNumber();
  const dayOfWeek = now.getDay();
  // Combine week number and day to create a unique seed for each day of each week
  return weekNumber * 7 + dayOfWeek;
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
    // Get songs from the JSON file
    const allSongs = songsData.songs;
    
    // Get today's seed based on week number and day
    const todaySeed = getTodaySeed();
    const shuffledTracks = seededShuffle(allSongs, todaySeed);
    
    // Try to find 5 tracks with previews by searching through more tracks
    const tracks: DeezerTrack[] = [];
    let attempts = 0;
    const maxAttempts = 20; // Try up to 20 tracks to find 5 with previews

    for (const track of shuffledTracks) {
      if (tracks.length >= 5 || attempts >= maxAttempts) break;
      attempts++;
      
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

    // Get the current week number
    const currentWeek = getWeekNumber();

    return NextResponse.json({
      tracks: responseTracks,
      day: getCurrentDay(),
      week: currentWeek,
      cooldownUntil: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
    });
  } catch (e: unknown) {
    console.error("Greška u API pozivu:", e);
    return NextResponse.json(
      { error: "Došlo je do greške pri dohvatu pjesama.", details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}