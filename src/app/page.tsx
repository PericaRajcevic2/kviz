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
  const intervalTimer = useRef<NodeJS.Timeout | null>(null);

  const [shake, setShake] = useState(false);

  // novo: koliko je vremena prošlo u ms tijekom trenutnog pokušaja
  const [elapsedTime, setElapsedTime] = useState(0);

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
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("Greška.");
        }
        setLoading(false);
      }
    }
    loadTracks();
  }, []);

  // svaki put kad se mijenja pjesma ili pokušaj, resetiraj
  useEffect(() => {
    setUserGuess("");
    setIsCorrect(false);
    setIsPlaying(false);
    setElapsedTime(0);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.load();
    }

    if (playTimeout.current) {
      clearTimeout(playTimeout.current);
      playTimeout.current = null;
    }
    if (intervalTimer.current) {
      clearInterval(intervalTimer.current);
      intervalTimer.current = null;
    }

    if (audioRef.current && tracks.length > 0) {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);

          // timeout za zaustavljanje reprodukcije nakon trajanja pokušaja
          playTimeout.current = setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.pause();
              setIsPlaying(false);
            }
            if (intervalTimer.current) {
              clearInterval(intervalTimer.current);
              intervalTimer.current = null;
            }
          }, ATTEMPT_DURATIONS[guessAttempt]);

          // interval za update elapsedTime svake 100ms
          intervalTimer.current = setInterval(() => {
            setElapsedTime((prev) => {
              const next = prev + 100;
              if (next >= ATTEMPT_DURATIONS[guessAttempt]) {
                if (intervalTimer.current) {
                  clearInterval(intervalTimer.current);
                  intervalTimer.current = null;
                }
                return ATTEMPT_DURATIONS[guessAttempt];
              }
              return next;
            });
          }, 100);
        })
        .catch(() => {
          // ignoriramo poruke o reprodukciji
          setIsPlaying(false);
        });
    }

    return () => {
      if (playTimeout.current) {
        clearTimeout(playTimeout.current);
        playTimeout.current = null;
      }
      if (intervalTimer.current) {
        clearInterval(intervalTimer.current);
        intervalTimer.current = null;
      }
    };
  }, [currentIndex, guessAttempt, tracks]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (playTimeout.current) clearTimeout(playTimeout.current);
      if (intervalTimer.current) {
        clearInterval(intervalTimer.current);
        intervalTimer.current = null;
      }
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
            if (intervalTimer.current) {
              clearInterval(intervalTimer.current);
              intervalTimer.current = null;
            }
          }, ATTEMPT_DURATIONS[guessAttempt]);
          intervalTimer.current = setInterval(() => {
            setElapsedTime((prev) => {
              const next = prev + 100;
              if (next >= ATTEMPT_DURATIONS[guessAttempt]) {
                if (intervalTimer.current) {
                  clearInterval(intervalTimer.current);
                  intervalTimer.current = null;
                }
                return ATTEMPT_DURATIONS[guessAttempt];
              }
              return next;
            });
          }, 100);
        })
        .catch(() => {
          setIsPlaying(false);
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
      shakeInput();
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
      if (intervalTimer.current) clearInterval(intervalTimer.current);
    } else {
      shakeInput();
    }
  };

  const shakeInput = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
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
      if (intervalTimer.current) clearInterval(intervalTimer.current);
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

  // postotak za punjenje trake (0 do 100%)
  const progressPercent =
    elapsedTime && ATTEMPT_DURATIONS[guessAttempt]
      ? Math.min((elapsedTime / ATTEMPT_DURATIONS[guessAttempt]) * 100, 100)
      : 0;

  return (
    <>
      <div className="container">
        <h1>Balkan Muzika Kviz</h1>

        <audio ref={audioRef} style={{ display: "none" }} controls>
          <source src={currentTrack.preview_url} type="audio/mpeg" />
          Tvoj browser ne podržava audio element.
        </audio>

        <div className="attempt-header">
          <span className="search-icon" role="img" aria-label="search">
            🔍
          </span>{" "}
          Pokušaj #{guessAttempt + 1} — Trajanje:{" "}
          {(ATTEMPT_DURATIONS[guessAttempt] / 1000).toFixed(1)} sekundi
        </div>

        <div className="progress-bar-wrapper">
          <div className="progress-bar-labels">
            <span>0s</span>
            <span>30s</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            ></div>

            {ATTEMPT_DURATIONS.map((_, i) => {
              let className = "";
              if (i < guessAttempt) className = "skipped";
              else if (i === guessAttempt) className = "active";

              return (
                <div key={i} className={`progress-segment ${className}`}>
                  {i + 1}
                </div>
              );
            })}
          </div>
        </div>

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
              className={`guess-input${shake ? " shake" : ""}`}
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
          background: linear-gradient(135deg,rgb(0, 119, 255),rgb(89, 87, 236));
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
          transition: transform 0.2s ease;
        }
        input.guess-input.shake {
          animation: shake 0.4s;
          border: 2px solid #ff3b3b;
          background-color: #660000;
          color: white;
        }
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25%,
          75% {
            transform: translateX(-6px);
          }
          50% {
            transform: translateX(6px);
          }
        }
        .album-cover {
          border-radius: 12px;
          margin: 12px 0;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
        }
        .attempt-header {
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 6px;
          text-shadow: 0 0 3px black;
        }
        .search-icon {
          font-size: 18px;
        }

        .progress-bar-wrapper {
          margin-bottom: 16px;
        }
        .progress-bar-labels {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          margin-bottom: 4px;
          font-weight: 600;
          text-shadow: 0 0 3px black;
        }
        .progress-bar {
          position: relative;
          height: 20px;
          background: rgba(0, 0, 0, 0.25);
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 6px;
          font-weight: 600;
          font-size: 12px;
          color: white;
          user-select: none;
          box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.4);
        }
        .progress-bar-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background:rgb(252, 252, 255);
          border-radius: 12px 0 0 12px;
          transition: width 0.1s linear;
          z-index: 0;
          pointer-events: none;
        }
        .progress-segment {
          position: relative;
          z-index: 1;
          width: 16px;
          height: 16px;
          line-height: 16px;
          text-align: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          color: #111;
          font-weight: 700;
          box-shadow: 0 0 3px black;
          user-select: none;
          font-size: 12px;
        }
        .progress-segment.skipped {
          background:rgb(255, 0, 0);
          color: white;
          box-shadow: 0 0 6pxrgb(105, 15, 8);
        }
        .progress-segment.active {
          background: #1db954;
          color: white;
          box-shadow: 0 0 8px #1db954;
        }
      `}</style>
    </>
  );
}
