import { NextRequest, NextResponse } from "next/server";

// Temporary hardcoded credentials for testing
const SPOTIFY_CLIENT_ID = "419ec4419c2347aa8ae53e514fbf5f6b";
const SPOTIFY_CLIENT_SECRET = "c6faa0081b324121a6078150a6680c3f";

async function getSpotifyAccessToken() {
  try {
    console.log('Getting token with credentials...');
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Token request failed:', {
        status: res.status,
        error: errorText
      });
      throw new Error(`Failed to get token: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    if (!data.access_token) {
      throw new Error('No access token in response');
    }

    console.log('Successfully got access token');
    return data.access_token;
  } catch (error) {
    console.error('Error getting Spotify token:', error);
    throw error;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    
    if (!q) {
      return NextResponse.json({ results: [] });
    }

    const accessToken = await getSpotifyAccessToken();
    if (!accessToken) {
      throw new Error('Failed to get access token');
    }

    // Search only for tracks with better parameters
    const searchUrl = `https://api.spotify.com/v1/search?type=track&limit=15&market=HR&q=${encodeURIComponent(q)}`;
    console.log('Searching Spotify with URL:', searchUrl);

    const apiRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      throw new Error(`Spotify API error: ${apiRes.status} ${errorText}`);
    }

    const apiData = await apiRes.json();
    
    // Process and sort tracks by popularity
    const tracks = (apiData.tracks?.items || [])
      .filter((item: any) => item.name && item.artists?.[0]?.name) // Filter out invalid entries
      .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0)) // Sort by popularity
      .map((item: any) => ({
        displayName: `${item.name} - ${item.artists?.[0]?.name || ""}`,
        name: item.name,
        artist: item.artists?.[0]?.name || "",
        image: item.album?.images?.[0]?.url || "",
        popularity: item.popularity || 0
      }));

    return NextResponse.json({ results: tracks });
  } catch (error) {
    console.error('Spotify search error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        results: []
      },
      { status: 500 }
    );
  }
} 