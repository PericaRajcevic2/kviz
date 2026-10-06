"use client";
import { useCallback, useEffect, useRef, useState } from "react";
type AudioData = { url: string; image: string | null; source: string | null };
export function useAudio(
  songId: string | undefined,
  duration: number,
  volume: number,
) {
  const ref = useRef<HTMLAudioElement>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [data, setData] = useState<AudioData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [retry, setRetry] = useState(0);
  const refreshedSong = useRef<string | undefined>(undefined);
  const stop = useCallback(() => {
    generation.current++;
    ref.current?.pause();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  }, []);
  useEffect(() => {
    stop();
    setElapsed(0);
    setData(null);
    setStatus("loading");
    setError("");
    if (!songId) return;
    const controller = new AbortController();
    fetch(
      `/api/audio/${encodeURIComponent(songId)}${retry ? "?refresh=1" : ""}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Audio trenutno nije dostupan.");
        if (typeof body.url !== "string" || !body.url.startsWith("https://"))
          throw new Error("Audio trenutno nije dostupan.");
        return body as AudioData;
      })
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
          setStatus("ready");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : "Audio se ne može učitati.",
          );
          setStatus("error");
        }
      });
    return () => {
      controller.abort();
      stop();
    };
  }, [songId, retry, stop]);
  useEffect(() => {
    stop();
    setElapsed(0);
    if (ref.current) ref.current.currentTime = 0;
  }, [duration, songId, stop]);
  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume, data]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [stop]);
  const playbackError = () => {
    stop();
    // A preview can expire while the tab is idle. Refresh once without
    // consuming an attempt; a persistent failure still exposes retry/replace.
    if (songId && refreshedSong.current !== songId) {
      refreshedSong.current = songId;
      setStatus("loading");
      setRetry((n) => n + 1);
      return;
    }
    setStatus("error");
    setError(
      "Isječak se ne može reproducirati. Pokušaj ponovo ili zamijeni pjesmu bez kazne.",
    );
  };
  const toggle = async () => {
    if (playing) {
      stop();
      return;
    }
    const audio = ref.current;
    if (!audio || status !== "ready") return;
    stop();
    const requestGeneration = generation.current;
    audio.currentTime = 0;
    audio.volume = volume;
    setElapsed(0);
    try {
      await audio.play();
      // A pending play request must not restart a track after navigation/unmount.
      if (
        generation.current !== requestGeneration ||
        ref.current !== audio ||
        !audio.isConnected
      ) {
        audio.pause();
        return;
      }
      setPlaying(true);
      timer.current = setInterval(() => {
        setElapsed(Math.min(audio.currentTime, duration));
        if (audio.currentTime >= duration || audio.ended) stop();
      }, 40);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      playbackError();
    }
  };
  return {
    ref,
    data,
    status,
    error,
    playing,
    elapsed,
    stop,
    toggle,
    playbackError,
    retry: () => setRetry((n) => n + 1),
  };
}
