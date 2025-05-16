"use client";

import { useEffect, useState, useRef } from "react";

type Track = {
  name: string;
  artist: string;
  preview_url: string;
  album_image: string;
};

const ATTEMPT_DURATIONS = [1000, 3000, 5000, 10000, 15000, 30000]; // ms

function randomSample<T>(arr: T[], n: number): T[] {
  const result: T[] = [];
  const taken = new Set<number>();
  while (result.length < n && result.length < arr.length) {
    const idx = Math.floor(Math.random() * arr.length);
    if (!taken.has(idx)) {
      taken.add(idx);
      result.push(arr[idx]);
    }
  }
  return result;
}

function startsWithSimilarity(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++;
  }
  return i / Math.max(a.length, b.length);
}

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [userGuess, setUserGuess] = useState("");
  const [isCorrect, setIsCorrect] = useState(false);
  const [guessAttempt, setGuessAttempt] = useState(0);

  const playTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadTracks() {
      try {
        const res = await fetch("/api/spotify");
        if (!res.ok) throw new Error("Greška pri dohvaćanju pjesama.");
        const data: Track[] = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("Nema pjesama za reprodukciju.");
        }
        setTracks(data);
        setCurrentIndex(0);
        setGuessAttempt(0);
        setLoading(false);
      } catch (e: unknown) {
        setError(e.message || "Greška.");
        setLoading(false);
      }
    }
    loadTracks();
  }, []);

  useEffect(() => {
    setUserGuess("");
    setIsCorrect(false);
    setIsPlaying(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.load();
    }

    if (playTimeout.current) {
      clearTimeout(playTimeout.current);
    }

    if (audioRef.current && tracks.length > 0) {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          playTimeout.current = setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.pause();
              setIsPlaying(false);
            }
          }, ATTEMPT_DURATIONS[guessAttempt]);
        })
        .catch(() => {
          setIsPlaying(false);
        });
    }
  }, [currentIndex, guessAttempt, tracks]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (playTimeout.current) clearTimeout(playTimeout.current);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          playTimeout.current = setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.pause();
              setIsPlaying(false);
            }
          }, ATTEMPT_DURATIONS[guessAttempt]);
        })
        .catch(() => {
          alert("Klikni bilo gdje na stranicu da dozvoliš reprodukciju zvuka.");
        });
    }
  };

  const checkGuess = () => {
    const currentTrack = tracks[currentIndex];
    if (!currentTrack) {
      alert("Trenutno nema aktivne pjesme.");
      return;
    }

    const parts = userGuess.split(" - ").map((p) => p.trim());
    if (parts.length !== 2) {
      alert("Unos mora biti u formatu: Izvođač - Naziv pjesme");
      return;
    }
    const [guessArtist, guessName] = parts;

    if (
      guessName.toLowerCase() === currentTrack.name.toLowerCase() &&
      guessArtist.toLowerCase() === currentTrack.artist.toLowerCase()
    ) {
      setIsCorrect(true);
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      if (playTimeout.current) clearTimeout(playTimeout.current);
    } else {
      alert("Netočno! Pokušaj ponovo.");
    }
  };

  const nextTrack = () => {
    if (tracks.length <= 1) return;

    const filteredTracks = tracks.filter((_, idx) => idx !== currentIndex);
    const randomIdx = Math.floor(Math.random() * filteredTracks.length);
    const newTrack = filteredTracks[randomIdx];
    const newIndex = tracks.findIndex(
      (t) => t.name === newTrack.name && t.artist === newTrack.artist
    );

    setCurrentIndex(newIndex);
    setGuessAttempt(0);
  };

  const nextAttempt = () => {
    if (guessAttempt < ATTEMPT_DURATIONS.length - 1) {
      setGuessAttempt(guessAttempt + 1);
    } else {
      setIsCorrect(true);
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      if (playTimeout.current) clearTimeout(playTimeout.current);
    }
  };

  if (loading) return <p>Učitavanje pjesama...</p>;
  if (error) return <p>Greška: {error}</p>;
  if (tracks.length === 0) return <p>Nema dostupnih pjesama.</p>;

  const currentTrack = tracks[currentIndex];

  let suggestions: string[] = [];
  if (userGuess.length >= 1) {
    const guessLower = userGuess.toLowerCase();

    const filtered = tracks
      .map((t) => `${t.artist} - ${t.name}`)
      .filter((full) => full.toLowerCase().includes(guessLower));

    const randomSuggestions = randomSample(filtered, 5);
    suggestions = randomSuggestions;

    const currentFull = `${currentTrack.artist} - ${currentTrack.name}`;
    const similarity = startsWithSimilarity(currentFull.toLowerCase(), guessLower);
    if (similarity >= 0.4 && !suggestions.includes(currentFull)) {
      suggestions.push(currentFull);
    }
    suggestions = Array.from(new Set(suggestions));
  }

  return (
    <>
      <div className="container">
        <h1>Balkan Muzika Kviz</h1>

        <audio ref={audioRef} style={{ display: "none" }} controls>
          <source src={currentTrack.preview_url} type="audio/mpeg" />
          Tvoj browser ne podržava audio element.
        </audio>

        <p className="attempt-info">
          Pokušaj #{guessAttempt + 1} - slušaj prvih{" "}
          {(ATTEMPT_DURATIONS[guessAttempt] / 1000).toFixed(1)} sekundi
        </p>

        {!isCorrect ? (
          <>
            <button onClick={togglePlay} className="playpause">
              {isPlaying ? "Pauziraj" : "Reproduciraj"}
            </button>

            <label htmlFor="guessInput">
              Pogodi izvođača i naziv pjesme (format: Izvođač - Naziv):
            </label>
            <input
              id="guessInput"
              type="text"
              list="guessSuggestions"
              value={userGuess}
              onChange={(e) => setUserGuess(e.target.value)}
              autoComplete="off"
              className="guess-input"
            />
            <datalist id="guessSuggestions">
              {suggestions.map((s, i) => (
                <option key={i} value={s} />
              ))}
            </datalist>

            <button onClick={checkGuess} className="check">
              Provjeri
            </button>

            <button onClick={nextAttempt} className="skip">
              Preskoči na duži isječak
            </button>
          </>
        ) : (
          <>
            <img
              src={currentTrack.album_image}
              alt={currentTrack.name}
              className="album-cover"
              width={200}
              height={200}
            />
            <h2>{currentTrack.name}</h2>
            <p>Izvođač: {currentTrack.artist}</p>

            <button onClick={nextTrack} className="skip">
              Sljedeća pjesma
            </button>
          </>
        )}
      </div>

      <style jsx>{`
        .container {
          max-width: 400px;
          margin: 40px auto;
          padding: 30px;
          background: linear-gradient(135deg, #1db954, #1ed760);
          border-radius: 15px;
          color: white;
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
          text-align: center;
        }
        h1 {
          margin-bottom: 20px;
          font-weight: 700;
        }
        button {
          width: 100%;
          padding: 14px;
          margin-bottom: 12px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }
        button.playpause {
          background-color: white;
          color: #1db954;
        }
        button.playpause:hover {
          background-color: #ccecd7;
        }
        button.check {
          background-color: #1db954;
          color: white;
        }
        button.check:hover {
          background-color: #17a04f;
        }
        button.skip {
          background-color: #eee;
          color: #333;
        }
        button.skip:hover {
          background-color: #ddd;
        }
        input.guess-input {
          width: 100%;
          padding: 12px;
          margin-bottom: 12px;
          border-radius: 8px;
          border: none;
          font-size: 16px;
          outline: none;
          box-sizing: border-box;
        }
        img.album-cover {
          border-radius: 12px;
          margin-bottom: 10px;
          max-width: 100%;
          height: auto;
        }
        p.attempt-info {
          margin-bottom: 15px;
          font-weight: 600;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </>
  );
}
