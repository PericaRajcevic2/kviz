"use client";

import { useEffect, useState, useRef} from "react";
import { ClipLoader } from "react-spinners";
import Image from "next/image";

type Track = {
  name: string;
  artist: string;
  preview_url: string;
  album_image: string;
  isCorrect?: boolean;
};

const ATTEMPT_DURATIONS = [1000, 3000, 5000, 10000, 15000, 30000];
const MAX_DAILY_ATTEMPTS = 5;

const normalizeText = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[čć]/g, 'c')
    .replace(/[đ]/g, 'd')
    .replace(/[š]/g, 's')
    .replace(/[ž]/g, 'z')
    .replace(/dž/g, 'dz')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

type Suggestion = {
  displayName: string;
  name: string;
  artist: string;
  image: string;
  popularity: number;
};

// Fetch Spotify artist suggestions
async function fetchSpotifyArtistSuggestions(query: string) {
  if (!query) return [];
  try {
    const res = await fetch(`/api/spotify-search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    if (!res.ok || data.error) {
      console.error('API error:', data.error || 'Unknown error');
      return [];
    }
    
    return data.results || [];
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return [];
  }
}

export default function Home() {
  // 1. All useState hooks first
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState<string | null>(null);
  const [guessedTracks, setGuessedTracks] = useState<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [userGuess, setUserGuess] = useState("");
  const [isCorrect, setIsCorrect] = useState(false);
  const [guessAttempt, setGuessAttempt] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [playedTracksCount, setPlayedTracksCount] = useState(0);
  const [correctGuessesCount, setCorrectGuessesCount] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [lastPlayedDate, setLastPlayedDate] = useState<string | null>(null);
  const [guessedOrder, setGuessedOrder] = useState<Track[]>([]);
  const [artistSuggestions, setArtistSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(true);
  const [isWrongGuess, setIsWrongGuess] = useState(false);

  // 2. All useRef hooks next
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTimeout = useRef<NodeJS.Timeout | null>(null);
  const intervalTimer = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // 3. All useEffect hooks next
  useEffect(() => {
  if (playedTracksCount > 0) {
    localStorage.setItem('guessedTracks', JSON.stringify([...guessedTracks]));
  }
}, [playedTracksCount, guessedTracks]);

useEffect(() => {
  const checkDateChange = () => {
    const today = new Date().toLocaleDateString();
    const savedDate = localStorage.getItem('lastPlayedDate');
    if (!savedDate || (savedDate && savedDate !== today)) {
      localStorage.removeItem('guessedTracks');
      setGuessedTracks(new Set());
        setPlayedTracksCount(0);
      setCooldownUntil(null);
      setCurrentIndex(0);
      setGuessAttempt(0);
      setUserGuess("");
      setIsCorrect(false);
      localStorage.setItem('lastPlayedDate', today);
    }
    setLastPlayedDate(today);
  };
  checkDateChange();
}, [lastPlayedDate]);

useEffect(() => {
  const today = new Date().toLocaleDateString();
  const savedDate = localStorage.getItem('lastPlayedDate');
  const savedGuesses = localStorage.getItem('guessedTracks');
  const savedPlayedCount = localStorage.getItem('playedTracksCount');
  if (!savedDate || savedDate !== today) {
    localStorage.removeItem('guessedTracks');
    localStorage.removeItem('playedTracksCount');
    localStorage.setItem('lastPlayedDate', today);
    setGuessedTracks(new Set());
    setPlayedTracksCount(0);
  } else {
    if (savedGuesses) {
      const parsedGuesses = JSON.parse(savedGuesses);
      setGuessedTracks(new Set(parsedGuesses));
      setPlayedTracksCount(parsedGuesses.length);
    }
    if (savedPlayedCount) {
      setPlayedTracksCount(parseInt(savedPlayedCount));
    }
  }
  async function loadTracks() {
    try {
      const res = await fetch("/api/spotify");
      if (!res.ok) throw new Error("Greška pri dohvaćanju pjesama.");
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      const tracksData = Array.isArray(data) ? data : data.tracks;
      const cooldown = data.cooldownUntil || null;
      const day = data.day || null;
      if (!Array.isArray(tracksData)) {
        throw new Error("Neispravan format pjesama.");
      }
      if (tracksData.length === 0) {
        throw new Error("Nema pjesama za reprodukciju.");
      }
      setTracks(tracksData);
      setCooldownUntil(cooldown);
      setCurrentDay(day);
      setLoading(false);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Greška.");
      }
      setLoading(false);
    }
  }
  loadTracks();
}, []);

useEffect(() => {
  localStorage.setItem('guessedTracks', JSON.stringify([...guessedTracks]));
  localStorage.setItem('playedTracksCount', playedTracksCount.toString());
}, [guessedTracks, playedTracksCount]);

  useEffect(() => {
    setVolume(0.5);
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [currentIndex, volume]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (cooldownUntil && now >= new Date(cooldownUntil)) {
        setCooldownUntil(null);
        setPlayedTracksCount(0);
        setGuessedTracks(new Set());
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!cooldownUntil) {
      setCountdown(null);
      return;
    }
    const updateCountdown = () => {
  try {
    const cooldownDate = new Date(cooldownUntil);
    setCountdown(formatCountdown(cooldownDate));
  } catch (error) {
    console.error("Invalid cooldown date:", cooldownUntil, error);
    setCountdown("00:00:00");
  }
};
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

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

  useEffect(() => {
    setVolume(0.5);
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
    }
  }, []);

  // Fetch Spotify artist suggestions on userGuess change
  useEffect(() => {
    let ignore = false;
    if (userGuess.length < 1) {
      setArtistSuggestions([]);
      return;
    }
    
    const fetchSuggestions = async () => {
      setSuggestionsLoading(true);
      try {
        const results = await fetchSpotifyArtistSuggestions(userGuess);
        if (!ignore) {
          setArtistSuggestions(results);
        }
      } catch (error) {
        console.error('Error in suggestions effect:', error);
        if (!ignore) {
          setArtistSuggestions([]);
        }
      } finally {
        if (!ignore) {
          setSuggestionsLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => {
      ignore = true;
      clearTimeout(timeoutId);
    };
  }, [userGuess]);

  // Add click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper functions
  const formatCountdown = (date: Date | null) => {
    if (!date) return "00:00:00";
    
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff <= 0) return "00:00:00";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTime = (ms: number) => {
    const seconds = ms / 1000;
    return seconds < 1 ? seconds.toFixed(1) : Math.floor(seconds).toString();
  };

  // Component functions
  const togglePlay = () => {
    console.log('Current track:', currentTrack);
    if (!audioRef.current || !currentTrack || !currentTrack.preview_url) {
      // Auto-skip to next track if no preview
      nextTrack();
      return;
    }

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
        .catch((error) => {
          console.error("Playback error:", error);
          setIsPlaying(false);
          alert("Došlo je do greške pri reprodukciji. Pokušajte ponovno.");
        });
    }
  };

  const checkGuess = () => {
    const currentTrack = tracks[currentIndex];
    if (!currentTrack) {
      alert("Trenutno nema aktivne pjesme.");
      return;
    }

    const normalizedGuess = normalizeText(userGuess);
    const normalizedTrackName = normalizeText(currentTrack.name);
    const normalizedArtist = normalizeText(currentTrack.artist);

    const parts1 = normalizedGuess.split(" - ").map((p) => p.trim());
    const parts2 = normalizedGuess.split("-").map((p) => p.trim());
    
    if (parts1.length === 2 || parts2.length === 2) {
      const [part1, part2] = parts1.length === 2 ? parts1 : parts2;
      
      if (
        (part1 === normalizedArtist && part2 === normalizedTrackName) ||
        (part1 === normalizedTrackName && part2 === normalizedArtist)
      ) {
        handleCorrectGuess(currentTrack);
        return;
      }
    }
    
    if (
      normalizedGuess === normalizedTrackName ||
      normalizedGuess === normalizedArtist ||
      normalizedGuess === `${normalizedArtist} ${normalizedTrackName}` ||
      normalizedGuess === `${normalizedTrackName} ${normalizedArtist}`
    ) {
      handleCorrectGuess(currentTrack);
      return;
    }

    // Handle wrong guess
    setIsWrongGuess(true);
    setTimeout(() => setIsWrongGuess(false), 500); // Reset after animation
    setUserGuess(""); // Clear the input
    nextAttempt(); // Move to next attempt instead of next song
  };

const handleCorrectGuess = (currentTrack: Track) => {
  setIsCorrect(true);
  setGuessedTracks(prev => {
    const newSet = new Set(prev);
    newSet.add(`${currentTrack.artist} - ${currentTrack.name}`);
    return newSet;
  });
    setGuessedOrder(prev => [...prev, { ...currentTrack, isCorrect: true }]);
  setPlayedTracksCount(prev => {
    const newCount = prev + 1;
    return newCount > MAX_DAILY_ATTEMPTS ? MAX_DAILY_ATTEMPTS : newCount;
  });
    setCorrectGuessesCount(prev => prev + 1);
  if (audioRef.current) {
    audioRef.current.pause();
    setIsPlaying(false);
  }
  if (playTimeout.current) clearTimeout(playTimeout.current);
  if (intervalTimer.current) clearInterval(intervalTimer.current);
};

const nextTrack = () => {
  // Provjerite da li je već dosegnut dnevni limit
  if (playedTracksCount >= MAX_DAILY_ATTEMPTS) {
    return;
  }

  // Pronađite sljedeću nepogođenu pjesmu
  const unusedTracks = tracks.filter(
    (t) => !guessedTracks.has(`${t.artist} - ${t.name}`)
  );

  if (unusedTracks.length > 0) {
    const nextTrack = unusedTracks[Math.floor(Math.random() * unusedTracks.length)];
    const newIndex = tracks.findIndex(
      (t) => t.name === nextTrack.name && t.artist === nextTrack.artist
    );
    setCurrentIndex(newIndex);
    setGuessAttempt(0);
    setIsCorrect(false);
  } else {
    // Ako su sve pjesme pogodene
    setPlayedTracksCount(MAX_DAILY_ATTEMPTS);
  }
};

  const nextAttempt = () => {
    if (guessAttempt < ATTEMPT_DURATIONS.length - 1) {
      setGuessAttempt(guessAttempt + 1);
    } else {
      // Mark as incorrect guess and show skipped modal
      setGuessedTracks(prev => {
        const newSet = new Set(prev);
        newSet.add(`${currentTrack.artist} - ${currentTrack.name}`);
        return newSet;
      });
      setGuessedOrder(prev => [...prev, { ...currentTrack, isCorrect: false }]);
      setPlayedTracksCount(prev => {
        const newCount = prev + 1;
        return newCount > MAX_DAILY_ATTEMPTS ? MAX_DAILY_ATTEMPTS : newCount;
      });
      setIsCorrect(true); // This will trigger the modal
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      if (playTimeout.current) clearTimeout(playTimeout.current);
      if (intervalTimer.current) clearInterval(intervalTimer.current);
    }
  };

if (loading) {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center gap-4">
        <ClipLoader size={60} color="#3B82F6" />
        <p className="text-lg text-gray-700">Učitavanje pjesama...</p>
      </div>
    </div>
  );
}

if (error) return <p className="text-red-500">Greška: {error}</p>;
if (tracks.length === 0) return <p className="text-gray-600">Nema dostupnih pjesama.</p>;

// Ako je korisnik već pogodio sve pjesme danas
if (playedTracksCount >= MAX_DAILY_ATTEMPTS) {
  return (
    <>
      <div className="container">
        <div className="end-screen-header">
          <h1 className="end-screen-title">KVIZ BALKANSKE MUZIKE</h1>
          {currentDay && (
            <div className="end-screen-day-info">
              <div className="end-screen-day-icon">📅</div>
              <p className="end-screen-day-text">Današnji dan: <span className="end-screen-day-value">{currentDay}</span></p>
            </div>
          )}
        </div>
        <div className="guessed-tracks-container">
          {guessedOrder.map((track, index) => (
            <div key={index} className={`guessed-track ${track.isCorrect ? 'correct' : 'incorrect'}`}>
              <div className="track-number">{index + 1}</div>
              <div className="track-info">
                <div className="track-name">{track.name}</div>
                <div className="track-artist">{track.artist}</div>
              </div>
              <div className="track-status">{track.isCorrect ? '✓' : '×'}</div>
            </div>
          ))}
        </div>
      </div>
      {showEndScreen && (
        <div className="end-screen-bg-fixed" onClick={() => setShowEndScreen(false)}>
          <div className="end-screen-glass-fixed" onClick={e => e.stopPropagation()}>
            <button className="end-screen-close" onClick={() => setShowEndScreen(false)}>×</button>
            <div className="trophy-icon">🏆</div>
            <h1 className="end-title">Čestitamo!</h1>
            {currentDay && <p className="end-day">Današnji dan: <span>{currentDay}</span></p>}
            <p className="end-subtitle">Iskoristili ste svih <b>5</b> pokušaja za danas.</p>
            <p className="end-score">Pogodili ste <span className="end-score-num">{correctGuessesCount}</span> od <span className="end-score-num">5</span> pjesama</p>
            <div className="end-countdown-section">
              <p className="end-next-label">Sljedeći pokušaji bit će dostupni za:</p>
              <div className="end-countdown-timer">{countdown || "00:00:00"}</div>
            </div>
            <p className="end-footer">Vidimo se sutra! 🎶 <span className="confetti-emoji">🎉🎊</span></p>
          </div>
        </div>
      )}
      <style jsx>{`
        .container {
          padding: 2rem;
          max-width: 800px;
          margin: 0 auto;
        }
        .guessed-tracks-container {
          margin-top: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .guessed-track {
          display: flex;
          align-items: center;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          gap: 1rem;
        }
        .guessed-track.correct {
          border-left: 4px solid #6fff57;
        }
        .guessed-track.incorrect {
          border-left: 4px solid #ff5757;
        }
        .track-number {
          font-size: 1.2rem;
          font-weight: bold;
          color: #bdbdbd;
          min-width: 2rem;
        }
        .track-info {
          flex: 1;
        }
        .track-name {
          font-size: 1.1rem;
          font-weight: 600;
          color: #fff;
        }
        .track-artist {
          font-size: 0.9rem;
          color: #bdbdbd;
        }
        .track-status {
          font-size: 1.5rem;
          font-weight: bold;
        }
        .guessed-track.correct .track-status {
          color: #6fff57;
        }
        .guessed-track.incorrect .track-status {
          color: #ff5757;
        }
        .end-screen-bg-fixed {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease-out;
        }
        .end-screen-glass-fixed {
          background: rgba(255,255,255,0.35);
          border-radius: 2rem;
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.18);
          padding: 3rem 2.5rem 2.5rem 2.5rem;
          max-width: 420px;
          width: 100%;
          text-align: center;
          position: relative;
          z-index: 2;
          animation: slideIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .trophy-icon {
          font-size: 3.5rem;
          margin-bottom: 1.2rem;
          animation: popIn 0.7s cubic-bezier(.68,-0.55,.27,1.55);
        }
        .end-title {
          font-size: 2.5rem;
          font-weight: 900;
          color: #fff;
          margin-bottom: 0.5rem;
          text-shadow: 0 2px 8px rgba(0,0,0,0.18);
        }
        .end-day {
          font-size: 1.1rem;
          color: #e0e0e0;
          margin-bottom: 1.2rem;
        }
        .end-subtitle {
          font-size: 1.2rem;
          color: #fff;
          margin-bottom: 0.7rem;
        }
        .end-score {
          font-size: 1.4rem;
          color: #ffd700;
          font-weight: 700;
          margin-bottom: 1.5rem;
        }
        .end-score-num {
          font-size: 1.7rem;
          color: #fff;
          font-weight: 900;
          text-shadow: 0 2px 8px rgba(0,0,0,0.18);
        }
        .end-countdown-section {
          margin-bottom: 1.5rem;
        }
        .end-next-label {
          color: #fff;
          font-size: 1.1rem;
          margin-bottom: 0.5rem;
        }
        .end-countdown-timer {
          font-family: monospace;
          font-size: 2.2rem;
          font-weight: 800;
          color: #fff;
          background: rgba(0,0,0,0.18);
          border-radius: 0.7rem;
          padding: 0.7rem 1.5rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          margin: 0 auto 0.5rem auto;
          display: inline-block;
          letter-spacing: 2px;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .end-footer {
          color: #fff;
          font-size: 1.2rem;
          margin-top: 1.5rem;
          opacity: 0.9;
        }
        .confetti-emoji {
          font-size: 1.5rem;
          margin-left: 0.3rem;
        }
        @keyframes popIn {
          0% { transform: scale(0); }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        .end-screen-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 3;
        }
        .end-screen-close:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: rotate(90deg);
        }
        .end-screen-header {
          text-align: center;
          margin-bottom: 3rem;
          padding: 2rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 1rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          animation: fadeIn 0.5s ease-out;
        }
        .end-screen-title {
          font-size: 2.8rem;
          font-weight: 800;
          color: #fff;
          margin-bottom: 1.5rem;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          letter-spacing: 1px;
        }
        .end-screen-day-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 0.8rem;
          max-width: 400px;
          margin: 0 auto;
        }
        .end-screen-day-icon {
          font-size: 1.8rem;
          animation: bounce 2s infinite;
        }
        .end-screen-day-text {
          font-size: 1.2rem;
          color: #fff;
          margin: 0;
        }
        .end-screen-day-value {
          color: #6fff57;
          font-weight: 700;
          font-size: 1.3rem;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

  const currentTrack = tracks[currentIndex];

  // Show modal if correct answer or skipped
  if (isCorrect) {
    console.log("Showing modal for", currentTrack);
    return (
      <>
        <div className="modal-backdrop" onClick={nextTrack}></div>
        <div className="modal-wrapper">
          <div className="modal-content">
            <div className="modal-header">
              <button className="modal-close" onClick={nextTrack}>×</button>
            </div>
            <div className="modal-body">
              <div className={`success-badge ${guessedOrder[guessedOrder.length - 1]?.isCorrect ? 'correct' : 'skipped'}`}>
                <span className="checkmark">{guessedOrder[guessedOrder.length - 1]?.isCorrect ? '✓' : '×'}</span>
              </div>
              <div className="album-wrapper">
        <Image
                  src={currentTrack.album_image}
                  alt={currentTrack.name}
                  className="album-image"
          width={200}
          height={200}
          priority
        />
              </div>
              <div className="track-details">
                <h2 className="track-title">{currentTrack.name}</h2>
                <p className="artist-name">Izvođač: {currentTrack.artist}</p>
                <div className="progress-wrapper">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${(playedTracksCount / MAX_DAILY_ATTEMPTS) * 100}%` }}
                    ></div>
                  </div>
                  <p className="progress-text">
                    Pogođeno {correctGuessesCount} od {MAX_DAILY_ATTEMPTS} pjesama
        </p>
                </div>
              </div>
              <button className="next-track-btn" onClick={nextTrack}>
                {guessedTracks.size >= tracks.length
                  ? "Čekajte sutrašnje pjesme"
                  : "Sljedeća pjesma"}
        </button>
      </div>
    </div>
        </div>
        <style jsx>{`
          .modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(5px);
            z-index: 1000;
            animation: fadeIn 0.3s ease-out;
          }

          .modal-wrapper {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1001;
            padding: 20px;
          }

          .modal-content {
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border-radius: 20px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            animation: slideIn 0.3s ease-out;
            overflow: hidden;
          }

          .modal-header {
            padding: 15px;
            display: flex;
            justify-content: flex-end;
          }

          .modal-close {
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .modal-close:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: rotate(90deg);
}

          .modal-body {
            padding: 20px;
            text-align: center;
          }

          .success-badge {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            animation: popIn 0.5s ease-out;
          }
          .success-badge.correct {
            background: #4caf50;
          }
          .success-badge.skipped {
            background: #ff5757;
          }
          .checkmark {
            color: white;
            font-size: 30px;
            font-weight: bold;
          }
          .album-wrapper {
            margin: 20px auto;
            width: 200px;
            height: 200px;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
            animation: scaleIn 0.5s ease-out;
          }

          .album-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .track-details {
            margin-top: 20px;
          }

          .track-title {
            font-size: 24px;
            font-weight: bold;
            color: white;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          }

          .artist-name {
            font-size: 16px;
            color: rgba(255, 255, 255, 0.9);
            margin-bottom: 20px;
          }

          .progress-wrapper {
            background: rgba(255, 255, 255, 0.1);
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
          }

          .progress-bar {
            height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 10px;
          }

          .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4caf50, #8bc34a);
            border-radius: 3px;
            transition: width 0.5s ease-out;
          }

          .progress-text {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.8);
          }

          .next-track-btn {
            background: linear-gradient(135deg, #ff9800, #ff5722);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
            margin-top: 20px;
            transition: all 0.3s ease;
          }

          .next-track-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(255, 152, 0, 0.4);
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes popIn {
            0% { transform: scale(0); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
          }

          @keyframes scaleIn {
            from { transform: scale(0.9); }
            to { transform: scale(1); }
          }
        `}</style>
      </>
    );
  }

  // Only show already guessed if isCorrect is false and track is in guessedTracks
  if (!isCorrect && guessedTracks.has(`${tracks[currentIndex]?.artist} - ${tracks[currentIndex]?.name}`)) {
    return (
      <div className="container">
        <h1 className="animate-fade-in">KVIZ BALKANSKE MUZIKE</h1>
        {currentDay && (
          <div className="day-info-container animate-fade-in-delay">
            <div className="day-info-icon">📅</div>
            <p className="day-info">Današnji dan: <span className="day-value">{currentDay}</span></p>
          </div>
        )}
        <div className="already-guessed animate-fade-in">
          <div className="already-guessed-icon">
            <div className="already-guessed-check">✓</div>
          </div>
          <div className="album-container">
            <div className="album-glow"></div>
            <Image
              src={tracks[currentIndex]?.album_image || ''}
              alt={tracks[currentIndex]?.name || ''}
              className="album-cover animate-scale"
              width={200}
              height={200}
              priority
            />
          </div>
          <div className="track-info">
            <h2 className="track-name animate-slide-up">{tracks[currentIndex]?.name}</h2>
            <p className="artist-name animate-slide-up-delay">
              <span className="artist-label">Izvođač:</span> {tracks[currentIndex]?.artist}
            </p>
            <div className="progress-indicator">
              <div className="progress-bar-fill animate-progress" style={{ width: `${(playedTracksCount / MAX_DAILY_ATTEMPTS) * 100}%` }}></div>
              <p className="guessed-count animate-fade-in-delay">
                Pogođeno <span className="guessed-number">{correctGuessesCount}</span> od <span className="total-number">{MAX_DAILY_ATTEMPTS}</span> pjesama
              </p>
            </div>
          </div>
          <button onClick={nextTrack} className="next-button animate-bounce">
            {guessedTracks.size >= tracks.length
              ? "Čekajte sutrašnje pjesme"
              : "Sljedeća pjesma"}
          </button>
        </div>
      </div>
    );
  }

  const progressPercent =
    elapsedTime && ATTEMPT_DURATIONS[guessAttempt]
      ? Math.min((elapsedTime / ATTEMPT_DURATIONS[guessAttempt]) * 100, 100)
      : 0;

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const newVolume = parseFloat(e.target.value);
  setVolume(newVolume);
  if (audioRef.current) {
    audioRef.current.volume = newVolume;
  }
};

return (
    <div className="songless-root">
      <header>
        <h1><span className="logo-main">KVIZ</span><span className="logo-less"> BALKANSKE MUZIKE</span></h1>
      </header>
      <div className="guess-slots">
        {[...Array(MAX_DAILY_ATTEMPTS)].map((_, i) => (
          <div
            className={`guess-slot${i < guessedOrder.length ? (guessedOrder[i].isCorrect ? ' guessed' : ' incorrect') : ''}${i === guessedOrder.length ? ' current' : ''}`}
            key={i}
          >
            {i < guessedOrder.length && (
              <span className="slot-label">{guessedOrder[i].artist} - {guessedOrder[i].name}</span>
            )}
      </div>
        ))}
        </div>
      <div className="songless-progress-section">
        <div className="songless-progress-header">
          <span className="songless-stage-label">Pokušaj {guessAttempt + 1}</span>
          <span className="songless-stage-time">{formatTime(elapsedTime)} sekundi</span>
              </div>
        <div className="songless-progress-bar-wrap">
          <div className="songless-progress-bar-bg">
            <div className="songless-progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
            {/* Checkpoints */}
            {ATTEMPT_DURATIONS.slice(0, -1).map((ms, i) => {
              const percent = (ms / ATTEMPT_DURATIONS[ATTEMPT_DURATIONS.length - 1]) * 100;
              return (
                <div
                  key={i}
                  className={`songless-progress-checkpoint${i === guessAttempt ? ' active' : ''}`}
                  style={{ left: `calc(${percent}% - 1px)` }}
                />
            );
          })}
        </div>
          <div className="songless-progress-times">
            <span>0:00</span>
            <span>0:30</span>
      </div>
        </div>
        <button className="play-btn-songless" onClick={() => { console.log('Play clicked, currentTrack:', currentTrack); togglePlay(); }}>
          <span className="play-icon">
            {isPlaying ? (
              // Pause SVG
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="8" width="6" height="20" rx="2.5" fill="#181a1b"/>
                <rect x="21" y="8" width="6" height="20" rx="2.5" fill="#181a1b"/>
              </svg>
            ) : (
              // Play SVG
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="18" cy="18" r="18" fill="none"/>
                <polygon points="13,10 28,18 13,26" fill="#181a1b"/>
              </svg>
            )}
          </span>
        </button>
      </div>
      {currentTrack && currentTrack.preview_url && (
        <audio
          ref={audioRef}
          src={currentTrack.preview_url}
          controls={false}
          preload="auto"
          style={{ display: 'none' }}
          onError={e => {
            console.error('Audio error:', e);
            nextTrack();
          }}
        />
      )}
      {!currentTrack?.preview_url && (
        <div className="no-preview-message">Nema dostupne pretpregleda za ovu pjesmu. Preskačem...</div>
      )}
      <div className={`search-section-songless ${isWrongGuess ? 'wrong-guess' : ''}`} ref={searchContainerRef}>
        <span className="search-icon-songless">🔍</span>
        <input
          className="search-input-songless"
          type="text"
          value={userGuess}
          onChange={(e) => {
            setUserGuess(e.target.value);
            if (e.target.value.length > 0) {
              setShowSuggestions(true);
            } else {
              setShowSuggestions(false);
            }
          }}
          onFocus={() => {
            if (userGuess.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder="Znaš pjesmu? Upisi naziv izvođača i pjesme"
          autoComplete="off"
        />
        {showSuggestions && (suggestionsLoading || artistSuggestions.length > 0) && (
          <ul className="suggestions-list-songless">
            {suggestionsLoading && (
              <li className="suggestion-item-songless">Učitavanje...</li>
            )}
            {artistSuggestions.map((s, i) => (
              <li
                key={i}
                className="suggestion-item-songless"
                onClick={() => {
                  setUserGuess(s.displayName);
                  setShowSuggestions(false);
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.7em' }}>
                  {s.image && (
                    <Image src={s.image} alt="cover" width={36} height={36} style={{ borderRadius: 18, objectFit: 'cover', boxShadow: '0 2px 8px #0002' }} />
                  )}
                  <span>
                    <b>{s.displayName}</b>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="button-row-songless">
        <button onClick={nextAttempt} className="skip-btn-songless">PRESKOČI</button>
        <button onClick={checkGuess} className="submit-btn-songless">POTVRDI</button>
          </div>
      <div className="volume-control-songless">
        <label htmlFor="volume" className="volume-label-songless">
          Glasnoća: <span className="volume-value-songless">{Math.round(volume * 100)}%</span>
          </label>
          <input
            type="range"
            id="volume"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
          className="volume-slider-songless"
          />
        </div>
      <main className="songless-footer">
        <footer className="footer-songless">
        © {new Date().getFullYear()} Perica Rajčević. Sva prava pridržana.
      </footer>
    </main>
      <style jsx>{`
        .songless-root {
          background: #181a1b;
          min-height: 100vh;
          color: #fff;
          font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
          padding-bottom: 40px;
        }
        header h1 {
          text-align: center;
          font-size: 2.5rem;
          margin: 2rem 0 1.5rem 0;
          letter-spacing: 1px;
        }
        .logo-main { font-weight: 800; }
        .logo-less { font-weight: 400; color: #bdbdbd; }
        .guess-slots {
  display: flex;
  flex-direction: column;
          gap: 1rem;
          margin: 0 auto 2rem auto;
          max-width: 600px;
        }
        .guess-slot {
          height: 48px;
          border: 2px solid #333;
          border-radius: 8px;
          background: #23272a;
          display: flex;
          align-items: center;
          padding-left: 1.2rem;
  font-size: 1.1rem;
          color: #bdbdbd;
          transition: border 0.2s, background 0.2s;
}
        .guess-slot.guessed {
          border: 2px solid #6fff57;
          background: #23272a;
          color: #fff;
        }
        .guess-slot.incorrect {
          border: 2px solid #ff5757;
          background: #23272a;
          color: #fff;
        }
        .guess-slot.current {
          border: 2px solid #fff;
        }
        .slot-label {
          font-weight: 600;
        }
        .songless-progress-section {
          margin: 2.5rem auto 1.5rem auto;
          max-width: 700px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.2rem;
}
        .songless-progress-header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
          font-weight: 900;
          font-size: 1.2rem;
          color: #6fff57;
          margin-bottom: 0.2rem;
          letter-spacing: 0.5px;
        }
        .songless-stage-label {
          font-weight: 900;
          color: #6fff57;
          font-size: 1.15rem;
        }
        .songless-stage-time {
  font-weight: 700;
          color: #b6ffb0;
          font-size: 1.05rem;
        }
        .songless-progress-bar-wrap {
          width: 100%;
          max-width: 700px;
          margin: 0 auto;
        }
        .songless-progress-bar-bg {
          width: 100%;
          height: 18px;
          background: #23272a;
  border-radius: 8px;
          position: relative;
          overflow: visible;
          border: 2px solid #888;
          box-shadow: 0 2px 8px rgba(0,0,0,0.10);
          margin-bottom: 0.2rem;
}
        .songless-progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #6fff57, #b6ffb0);
          border-radius: 8px;
          transition: width 0.3s cubic-bezier(.4,2,.6,1);
          position: absolute;
          left: 0; top: 0;
          z-index: 1;
        }
        .songless-progress-checkpoint {
          position: absolute;
          top: -4px;
          width: 2px;
          height: 26px;
          background: #fff;
          opacity: 0.85;
          z-index: 3;
          border-radius: 1px;
          box-shadow: 0 0 2px #23272a;
          pointer-events: none;
          transition: background 0.2s;
        }
        .songless-progress-checkpoint.active {
          background: #6fff57;
          box-shadow: 0 0 8px #6fff57;
        }
        .songless-progress-times {
          width: 100%;
          display: flex;
          justify-content: space-between;
          font-size: 1.05rem;
          color: #bdbdbd;
          font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
          font-weight: 700;
          margin-top: 0.1rem;
          letter-spacing: 0.5px;
        }
        .play-btn-songless {
          background: linear-gradient(135deg, #6fff57 60%, #b6ffb0 100%);
          border: none;
          border-radius: 50%;
          width: 60px;
          height: 60px;
          color: #181a1b;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(111,255,87,0.18);
          transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
          cursor: pointer;
          margin: 1rem auto 1rem auto;
          padding: 0;
          outline: none;
          position: relative;
        }
        .play-btn-songless:hover {
          background: linear-gradient(135deg, #4edb3a 60%, #6fff57 100%);
          transform: scale(1.08);
          box-shadow: 0 8px 24px rgba(111,255,87,0.25);
        }
        .play-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          margin: 0;
          padding: 0;
        }
        .search-section-songless {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 2rem auto 0 auto;
          max-width: 600px;
          background: #23272a;
          border-radius: 8px;
          border: 2px solid #333;
          padding: 0.5rem 1rem;
          z-index: 20;
        }
        .search-icon-songless {
          margin-right: 0.5rem;
          color: #bdbdbd;
          font-size: 1.2rem;
        }
        .search-input-songless {
          flex: 1;
          background: transparent;
          border: none;
          color: #fff;
          font-size: 1.1rem;
          outline: none;
          padding: 0.5rem 0;
        }
        .suggestions-list-songless {
          position: absolute;
          width: 100%;
          max-width: 600px;
          left: 50%;
          transform: translateX(-50%);
          background: #23272a;
          border-radius: 8px;
          margin-top: 5px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 10;
          color: #fff;
          text-align: left;
          padding: 0;
          list-style: none;
          max-height: 400px;
          overflow-y: auto;
          top: 100%;
        }
        .suggestion-item-songless {
          padding: 12px 18px;
          cursor: pointer;
          border-bottom: 1px solid #333;
          display: flex;
          align-items: center;
          transition: background-color 0.2s;
        }
        .suggestion-item-songless:last-child {
          border-bottom: none;
        }
        .suggestion-item-songless:hover {
          background: #333;
        }
        .button-row-songless {
          display: flex;
          gap: 1rem;
          margin: 2rem auto 0 auto;
          max-width: 600px;
          justify-content: center;
        }
        .skip-btn-songless {
          background: #bdbdbd;
          color: #181a1b;
          border: none;
          border-radius: 8px;
          font-weight: 700;
          font-size: 1.1rem;
          padding: 0.7rem 2.2rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .skip-btn-songless:hover {
          background: #a0a0a0;
        }
        .submit-btn-songless {
          background: #6fff57;
          color: #181a1b;
          border: none;
          border-radius: 8px;
          font-weight: 700;
          font-size: 1.1rem;
          padding: 0.7rem 2.2rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .submit-btn-songless:hover {
          background: #4edb3a;
        }
        .volume-control-songless {
          margin: 2rem auto 0 auto;
          max-width: 600px;
          text-align: left;
        }
        .volume-label-songless {
          display: block;
          font-size: 1rem;
          color: #bdbdbd;
          margin-bottom: 0.5rem;
        }
        .volume-value-songless {
          color: #6fff57;
          font-weight: 700;
        }
        .volume-slider-songless {
          width: 100%;
          accent-color: #6fff57;
          height: 6px;
          border-radius: 3px;
          background: #23272a;
        }
        .songless-footer {
          margin-top: 3rem;
        }
        .footer-songless {
          width: 100%;
          text-align: center;
          color: #bdbdbd;
          font-size: 0.95rem;
          padding: 2rem 0 0 0;
          }
        .no-preview-message {
          color: #ff9800;
          text-align: center;
          margin: 1rem 0;
          font-weight: 600;
          }
        .wrong-guess {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
          border: 2px solid #ff5757 !important;
        }
        @keyframes shake {
          10%, 90% {
            transform: translate3d(-1px, 0, 0);
          }
          20%, 80% {
            transform: translate3d(2px, 0, 0);
          }
          30%, 50%, 70% {
            transform: translate3d(-4px, 0, 0);
          }
          40%, 60% {
            transform: translate3d(4px, 0, 0);
          }
        }
        @media (max-width: 700px) {
          .guess-slots, .progress-bar-songless, .search-section-songless, .button-row-songless, .volume-control-songless {
            max-width: 98vw;
          }
        }
        .suggestions-list-songless::-webkit-scrollbar {
          width: 8px;
        }
        .suggestions-list-songless::-webkit-scrollbar-track {
          background: #23272a;
          border-radius: 4px;
        }
        .suggestions-list-songless::-webkit-scrollbar-thumb {
          background: #444;
          border-radius: 4px;
        }
        .suggestions-list-songless::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
}