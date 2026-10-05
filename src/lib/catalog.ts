import data from "@/data/songs.json";
import type { Song } from "./game";
export const songs = data.songs as Song[];
export const songById = new Map(songs.map((song) => [song.id, song]));
