/*

// components/DeezerSuggestions.tsx
"use client";

const DEEZER_API_URL = "https://api.deezer.com";

export const getDeezerSuggestions = async (
  query: string,
  currentTrack: { artist: string; name: string },
  attempt: number
) => {
  try {
    // 1. Prvo dohvati prijedloge iz Deezer API-ja
    const searchUrl = `${DEEZER_API_URL}/search?q=${encodeURIComponent(query)}&limit=10`;
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    // 2. Pripremi osnovne prijedloge
    let suggestions = data.data?.map(
      (item: any) => `${item.artist.name} - ${item.title}`
    ) || [];

    // 3. Dodaj trenutnu pjesmu ako postoji sličnost
    const currentFull = `${currentTrack.artist} - ${currentTrack.name}`;
    const normalizedQuery = query.toLowerCase();
    const normalizedCurrent = currentFull.toLowerCase();
    
    if (normalizedCurrent.includes(normalizedQuery)) {
      suggestions.unshift(currentFull); // Dodaj na početak
    }

    // 4. Filtriraj duplikate
    suggestions = [...new Set(suggestions)];

    // 5. Progresivno poboljšanje preciznosti
    const precisionFactor = Math.min(1, query.length / 5); // 0-1 ovisno o dužini upita
    
    if (precisionFactor < 0.3) {
      // Za kratke upite - više random rezultata
      const randomIndex = Math.floor(Math.random() * suggestions.length);
      suggestions = suggestions.slice(randomIndex, randomIndex + 5);
    } else if (precisionFactor < 0.6) {
      // Srednje duži upiti - mix točnih i random
      suggestions = suggestions
        .sort(() => 0.5 - Math.random())
        .slice(0, 5);
    } else {
      // Dugi upiti - najtočniji rezultati
      suggestions = suggestions.slice(0, 5);
    }

    // 6. Popuni sa random pjesmama ako treba
    if (suggestions.length < 5) {
      const randomTracks = await fetch(
        `${DEEZER_API_URL}/chart/0/tracks&limit=20`
      ).then(res => res.json());
      
      const randomSuggestions = randomTracks.data
        .map((item: any) => `${item.artist.name} - ${item.title}`)
        .filter((s: string) => !suggestions.includes(s))
        .slice(0, 5 - suggestions.length);
      
      suggestions.push(...randomSuggestions);
    }

    return suggestions.slice(0, 5);
  } catch (error) {
    console.error("Deezer API error:", error);
    return [];
  }
};

*/