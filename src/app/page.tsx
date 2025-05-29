"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { ClipLoader } from "react-spinners";
import Image from "next/image";

type Track = {
  name: string;
  artist: string;
  preview_url: string;
  album_image: string;
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
  const [shake, setShake] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [playedTracksCount, setPlayedTracksCount] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [lastPlayedDate, setLastPlayedDate] = useState<string | null>(null);

  // 2. All useRef hooks next
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTimeout = useRef<NodeJS.Timeout | null>(null);
  const intervalTimer = useRef<NodeJS.Timeout | null>(null);
  const usedTracksRef = useRef<Set<string>>(new Set());

  // 3. useMemo hooks
  const isCooldownActive = useMemo(() => {
    if (!cooldownUntil) return false;
    try {
      const now = new Date();
      const cooldownDate = new Date(cooldownUntil);
      return now < cooldownDate;
    } catch {
      console.error("Invalid cooldownUntil date:", cooldownUntil);
      return false;
    }
  }, [cooldownUntil]);

  // 4. Derived constants
  const reachedMaxAttempts = playedTracksCount >= MAX_DAILY_ATTEMPTS;
  //const allTracksGuessed = guessedTracks.size >= MAX_DAILY_ATTEMPTS;
  const maxMemorySize = 20;

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
  useEffect(() => {
  if (playedTracksCount > 0) {
    localStorage.setItem('guessedTracks', JSON.stringify([...guessedTracks]));
  }
}, [playedTracksCount, guessedTracks]);


  // 5. All useEffect hooks in stable order
useEffect(() => {
  const checkDateChange = () => {
    const today = new Date().toLocaleDateString();
    const savedDate = localStorage.getItem('lastPlayedDate');
    
    // Ako je novi dan ili nema spremljenog datuma
    if (!savedDate || (savedDate && savedDate !== today)) {
      localStorage.removeItem('guessedTracks');
      setGuessedTracks(new Set());
      setPlayedTracksCount(0); // Resetujemo brojač pogodaka
      setCooldownUntil(null);
      setCurrentIndex(0);
      setGuessAttempt(0);
      setUserGuess("");
      setIsCorrect(false);
      
      // Spremimo današnji datum
      localStorage.setItem('lastPlayedDate', today);
    }
    setLastPlayedDate(today);
  };

  checkDateChange();
}, [lastPlayedDate]);

useEffect(() => {
  const savedGuesses = localStorage.getItem('guessedTracks');
  const savedDate = localStorage.getItem('lastPlayedDate');
  const today = new Date().toLocaleDateString();

  if (savedGuesses && savedDate === today) {
    const parsedGuesses = JSON.parse(savedGuesses);
    setGuessedTracks(new Set(parsedGuesses));
    setPlayedTracksCount(parsedGuesses.length); // Postavimo brojač na broj spremljenih pogodaka
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
  }, [guessedTracks]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

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

  // Component functions
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

    shakeInput();
  };


const handleCorrectGuess = (currentTrack: Track) => {
  setIsCorrect(true);
  setGuessedTracks(prev => {
    const newSet = new Set(prev);
    newSet.add(`${currentTrack.artist} - ${currentTrack.name}`);
    // Spremimo broj pogodaka u stanje
    setPlayedTracksCount(newSet.size);
    return newSet;
  });
  
  if (audioRef.current) {
    audioRef.current.pause();
    setIsPlaying(false);
  }
  if (playTimeout.current) clearTimeout(playTimeout.current);
  if (intervalTimer.current) clearInterval(intervalTimer.current);
};

  const shakeInput = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const nextTrack = () => {
    setPlayedTracksCount(prev => prev + 1);
    
    if (tracks.length <= 1) return;

    const usedKeys = usedTracksRef.current;
    const currentKey = `${tracks[currentIndex].artist} - ${tracks[currentIndex].name}`;

    usedKeys.add(currentKey);
    if (usedKeys.size > maxMemorySize) {
      const first = usedKeys.values().next().value;
      if (first !== undefined) {
        usedKeys.delete(first);
      }
    }

    const unusedTracks = tracks.filter(
      (t) => !usedKeys.has(`${t.artist} - ${t.name}`) && 
             !guessedTracks.has(`${t.artist} - ${t.name}`)
    );

    let nextTrack;
    if (unusedTracks.length > 0) {
      nextTrack = unusedTracks[Math.floor(Math.random() * unusedTracks.length)];
    } else {
      usedTracksRef.current = new Set();
      nextTrack = tracks[Math.floor(Math.random() * tracks.length)];
    }

    const newIndex = tracks.findIndex(
      (t) => t.name === nextTrack.name && t.artist === nextTrack.artist
    );

    setCurrentIndex(newIndex);
    setGuessAttempt(0);
    setIsCorrect(false);
  };

  const nextAttempt = () => {
    if (guessAttempt < ATTEMPT_DURATIONS.length - 1) {
      setGuessAttempt(guessAttempt + 1);
    } else {
      setIsCorrect(true);
      setPlayedTracksCount(prev => prev + 1);
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



if (isCooldownActive && reachedMaxAttempts) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white p-8 rounded-lg shadow-xl max-w-md mx-auto">
      <h1 className="text-4xl font-extrabold mb-4 drop-shadow-lg">KVIZ BALKANSKE MUZIKE</h1>
      {currentDay && <p className="mb-6 text-lg italic opacity-80">Današnji dan: {currentDay}</p>}
      {tracks.length > 0 && (
        <audio ref={audioRef} style={{ display: "none" }} controls>
          <source src={tracks[currentIndex]?.preview_url || ''} type="audio/mpeg" />
          Tvoj browser ne podržava audio element.
        </audio>
      )}
      <p className="text-center text-xl font-semibold mb-2">Iskoristili ste svih 5 pokušaja za danas.</p>
      <p className="text-center mb-2">Pogodili ste {playedTracksCount} od 5 pjesama.</p>
      <p className="text-center mb-4">Sljedeći pokušaji bit će dostupni za:</p>
      <p className="countdown-timer text-3xl font-mono font-bold bg-white text-purple-800 rounded-md px-6 py-3 shadow-lg animate-pulse">
        {countdown || "učitavanje..."}
      </p>
    </div>
  );
}


/*if (isCooldownActive && guessedTracks.size >= 5) {
  return (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-tr from-green-600 via-emerald-600 to-teal-600 text-white p-8 rounded-lg shadow-xl max-w-md mx-auto text-center">
    <h1 className="text-4xl font-extrabold mb-6 drop-shadow-lg">KVIZ BALKANSKE MUZIKE</h1>
    <div className="cooldown-message space-y-4">
      <p className="text-2xl font-semibold">To je to za danas!</p>
      <p className="text-lg">Pogodili ste svih 5 pjesama! 🎉</p>
      <p className="text-lg">Novi set od 5 pjesama biti će dostupan:</p>
      <p className="cooldown-time text-xl font-mono font-bold bg-white text-green-700 rounded-md px-6 py-3 shadow-md">
        {new Date().getDate() !== new Date(cooldownUntil).getDate() 
          ? "sutra" 
          : `danas u ${new Date(cooldownUntil).toLocaleTimeString()}`}
      </p>
    </div>
  </div>
  );
}
*/

// Modificirajte prikaz cooldown-a
/*{isCooldownActive && allTracksGuessed && (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-tr from-green-600 via-emerald-600 to-teal-600 text-white p-8 rounded-lg shadow-xl max-w-md mx-auto text-center">
    <h1 className="text-4xl font-extrabold mb-6 drop-shadow-lg">KVIZ BALKANSKE MUZIKE</h1>
    <div className="cooldown-message space-y-4">
      <p className="text-2xl font-semibold">To je to za danas!</p>
      <p className="text-lg">Pogodili ste svih 5 pjesama! 🎉</p>
      <p className="text-lg">Novi set od 5 pjesama biti će dostupan:</p>
      <p className="cooldown-time text-xl font-mono font-bold bg-white text-green-700 rounded-md px-6 py-3 shadow-md">
        {new Date().getDate() !== new Date(cooldownUntil).getDate() 
          ? "sutra" 
          : `danas u ${new Date(cooldownUntil).toLocaleTimeString()}`}
      </p>
    </div>
  </div>
)}
*/
  const currentTrack = tracks[currentIndex];
  const progressPercent =
    elapsedTime && ATTEMPT_DURATIONS[guessAttempt]
      ? Math.min((elapsedTime / ATTEMPT_DURATIONS[guessAttempt]) * 100, 100)
      : 0;


let suggestions: string[] = [];
if (userGuess.length >= 1) {
  const guessLower = normalizeText(userGuess);
  
  // 1. Napravimo listu svih mogućih pjesama
  const allPossibleSuggestions = tracks.map(t => `${t.artist} - ${t.name}`);
  
  // 2. Izvučemo one koje sadrže upisani tekst
  const matchingSuggestions = allPossibleSuggestions.filter(s => 
    normalizeText(s).includes(guessLower)
  );
  
  // 3. Dodamo trenutnu pjesmu ako je sličnost dovoljno velika
  const currentFull = `${currentTrack.artist} - ${currentTrack.name}`;
  const currentNormalized = normalizeText(currentFull);
  const similarity = startsWithSimilarity(currentNormalized, guessLower);
  
  if (similarity >= 0.4 && !matchingSuggestions.includes(currentFull)) {
    matchingSuggestions.push(currentFull);
  }
  
  // 4. Dodamo nekoliko potpuno nasumičnih pjesama (30% šanse)
  if (Math.random() < 0.3) {
    const randomTracks = randomSample(
      allPossibleSuggestions.filter(s => !matchingSuggestions.includes(s)),
      2
    );
    matchingSuggestions.push(...randomTracks);
  }
  
  // 5. Izmiješamo sve prijedloge
  suggestions = randomSample(matchingSuggestions, 5);
  
  // 6. Ako ima previše prijedloga, uzmemo prvih 5
  suggestions = suggestions.slice(0, 5);
}

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const newVolume = parseFloat(e.target.value);
  setVolume(newVolume);
  if (audioRef.current) {
    audioRef.current.volume = newVolume;
  }
};

return (
  <>
    <div className="container">
      <h1>KVIZ BALKANSKE MUZIKE</h1>
      {currentDay && <p className="day-info">Današnji dan: {currentDay}</p>}

      <audio ref={audioRef} style={{ display: "none" }} controls>
        <source src={currentTrack.preview_url} type="audio/mpeg" />
        Tvoj browser ne podržava audio element.
      </audio>

      

      <div className="stage-info">
        <div className="stage-title">Pokušaj {guessAttempt + 1}</div>
        <div className="stage-time">{formatTime(elapsedTime)} sekundi</div>
      </div>

      <div className="progress-container">
        <div className="progress-labels">
          <span>0:00</span>
          <span>0:30</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-bar"
            style={{ width: `${progressPercent}%` }}
          ></div>
          {ATTEMPT_DURATIONS.map((_, i) => {
            let status = "";
            if (i < guessAttempt) status = "skipped";
            else if (i === guessAttempt) status = "active";

            return (
              <div key={i} className={`progress-marker ${status}`}>
                {i + 1}
              </div>
            );
          })}
        </div>
      </div>

      {!isCorrect ? (
        <>
          <div className="search-container">
            <div className="search-icon">🔍</div>
            <input
              type="text"
              value={userGuess}
              onChange={(e) => {
                setUserGuess(e.target.value);
                setShowSuggestions(true);
              }}
              placeholder="Znaš pjesmu? Upisi naziv izvođača i pjesme"
              className={`search-input ${shake ? "shake" : ""}`}
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="suggestions-list">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="suggestion-item"
                    onClick={() => {
                      setUserGuess(s);
                      setShowSuggestions(false);
                    }}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="button-group">
            <button onClick={nextAttempt} className="skip-button">
              PRESKOČI
            </button>
            <button onClick={checkGuess} className="submit-button">
              POTVRDI
            </button>
          </div>

          <button onClick={togglePlay} className="play-button">
            {isPlaying ? "Pauziraj" : "Pokreni"}
          </button>

          {/* Dodan slider za glasnoću */}
        <div className="volume-control mb-6 w-full max-w-md mx-auto">
          <label htmlFor="volume" className="block text-sm font-semibold text-gray-800 mb-2 select-none">
            Glasnoća: <span className="text-indigo-600"> {Math.round(volume * 100)}% </span>
          </label>
          <input
            type="range"
            id="volume"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        </>
      ) : (
        <>
          <div className="correct-answer">
            <Image
              src={currentTrack.album_image}
              alt={currentTrack.name}
              className="album-cover"
              width={200}
              height={200}
              priority
            />
            <h2>{currentTrack.name}</h2>
            <p>Izvođač: {currentTrack.artist}</p>
            <p className="guessed-count">
            Pogođeno {playedTracksCount} od {MAX_DAILY_ATTEMPTS} pjesama
            </p>
          </div>

          <button onClick={nextTrack} className="next-button">
            {guessedTracks.size >= tracks.length
              ? "Čekajte sutrašnje pjesme"
              : "Sljedeća pjesma"}
          </button>
        </>
      )}
    </div>

    <main className="flex flex-col min-h-screen items-center justify-between p-8">
      {/* Glavni sadržaj */}
      <div className="flex-1 w-full max-w-2xl"></div>

      {/* Footer */}
      <footer className="w-full text-center text-sm text-gray-500 py-4 mt-8">
        © {new Date().getFullYear()} Perica Rajčević. Sva prava pridržana.
      </footer>
    </main>
  

      <style jsx>{`
        .container {
          max-width: 400px;
          margin: 40px auto;
          padding: 30px;
          background: linear-gradient(135deg, #2c3e50, #4ca1af);
          border-radius: 15px;
          color: white;
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
          text-align: center;
        }

        h1 {
          margin-bottom: 30px;
          font-weight: 700;
          font-size: 24px;
        }
        
                .day-info {
          font-size: 14px;
          margin-bottom: 10px;
          color: rgba(255, 255, 255, 0.8);
        }

.cooldown-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  max-width: 400px;
  margin: 0 auto;
  background: linear-gradient(90deg, #6b21a8, #4338ca, #2563eb); /* ljubičasto-plavi gradient */
  color: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(101, 31, 255, 0.6);
  text-align: center;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.cooldown-container h1 {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 1rem;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
}

.day-info {
  font-style: italic;
  opacity: 0.8;
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
}

.cooldown-container p {
  font-size: 1.25rem;
  margin-bottom: 0.8rem;
}

.countdown-timer {
  font-family: monospace;
  font-weight: 700;
  font-size: 2rem;
  background: white;
  color: #7c3aed; /* ljubičasta */
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(124, 58, 237, 0.5);
  animation: pulse 2s infinite;
  display: inline-block;
}

/* Animacija suptilnog treptanja */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Za cooldown-message u drugom slučaju */
.cooldown-message {
  margin-top: 1rem;
}

.cooldown-message p {
  font-size: 1.3rem;
  margin-bottom: 1rem;
}

.cooldown-time {
  font-family: monospace;
  font-weight: 700;
  font-size: 1.75rem;
  background: white;
  color: #22c55e; /* zelena */
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(34, 197, 94, 0.5);
  display: inline-block;
}

        .guessed-count {
          margin-top: 10px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.7);
        }
          
        .stage-info {
          margin-bottom: 15px;
        }

        .stage-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 5px;
        }

        .stage-time {
          font-size: 14px;
          opacity: 0.8;
        }

        .progress-container {
          margin-bottom: 25px;
        }

        .progress-labels {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 5px;
        }

        .progress-track {
          position: relative;
          height: 20px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
        }

        .progress-bar {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: rgba(255, 255, 255, 0.5);
          transition: width 0.1s linear;
        }

        .progress-marker {
          position: relative;
          z-index: 1;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          color: #333;
          font-weight: 600;
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .progress-marker.skipped {
          background: #ff4d4d;
          color: white;
        }

        .progress-marker.active {
          background: #4caf50;
          color: white;
        }

        .search-container {
          position: relative;
          margin-bottom: 20px;
        }

        .search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 18px;
        }

        .search-input {
          width: 100%;
          padding: 12px 12px 12px 35px;
          border-radius: 8px;
          border: none;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
        }

        .search-input.shake {
          animation: shake 0.4s;
          border: 2px solid #ff3b3b;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25%, 75% { transform: translateX(-6px); }
          50% { transform: translateX(6px); }
        }

        .suggestions-list {
          position: absolute;
          width: 100%;
          max-height: 200px;
          overflow-y: auto;
          background: white;
          border-radius: 8px;
          margin-top: 5px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 10;
          color: #333;
          text-align: left;
          padding: 0;
          list-style: none;
        }

        .suggestion-item {
          padding: 8px 15px;
          cursor: pointer;
        }

        .suggestion-item:hover {
          background: #f0f0f0;
        }

        .button-group {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
        }

        button {
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .skip-button {
          flex: 1;
          background: #e0e0e0;
          color: #333;
        }

        .skip-button:hover {
          background: #d0d0d0;
        }

        .submit-button {
          flex: 1;
          background: #4caf50;
          color: white;
        }

        .submit-button:hover {
          background: #3e8e41;
        }

        .play-button {
          width: 100%;
          background: #2196f3;
          color: white;
          margin-bottom: 0;
        }

        .play-button:hover {
          background: #0b7dda;
        }

        .album-cover {
          border-radius: 8px;
          margin-bottom: 15px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .correct-answer h2 {
          margin: 10px 0 5px;
          font-size: 20px;
        }

        .correct-answer p {
          margin: 0 0 20px;
          opacity: 0.8;
        }

        .next-button {
          width: 100%;
          background: #ff9800;
          color: white;
        }

        .next-button:hover {
          background: #e68a00;
        }

        /* Mobilni stilovi */
        @media (max-width: 768px) {
          .container {
            max-width: 95%;
            margin: 20px auto;
            padding: 20px;
          }

          h1 {
            font-size: 22px;
            margin-bottom: 20px;
          }

          .progress-track {
            height: 18px;
          }

          .progress-marker {
            width: 14px;
            height: 14px;
            font-size: 9px;
          }

          .search-input {
            padding: 10px 10px 10px 35px;
            font-size: 14px;
          }

          button {
            padding: 10px;
            font-size: 14px;
          }

          .album-cover {
            width: 180px !important;
            height: 180px !important;
          }
        }

        @media (max-width: 480px) {
          .container {
            padding: 15px;
          }

          h1 {
            font-size: 20px;
          }

          .progress-track {
            height: 16px;
            padding: 0 8px;
          }

          .progress-marker {
            width: 12px;
            height: 12px;
            font-size: 8px;
          }

          .search-input {
            font-size: 13px;
          }

          button {
            padding: 8px;
          }

          .album-cover {
            width: 160px !important;
            height: 160px !important;
          }
        }
      `}</style>
    </>
  );
}