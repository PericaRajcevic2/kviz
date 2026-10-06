import data from "@/data/songs.json";
import type { Song } from "./game";
export const songs = (data.songs as Song[]).filter(
  (song) => !song.audioUnavailable,
);
export const songById = new Map(songs.map((song) => [song.id, song]));
