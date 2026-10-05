import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  advance,
  dayKey,
  DURATIONS,
  makeSession,
  moreAudio,
  nextReset,
  parseRecords,
  parseSession,
  replaceUnavailable,
  streak,
  submitGuess,
  judgeGuess,
  totalScore,
  type Song,
} from "../src/lib/game";
import { matchTrack, safePreview } from "../src/lib/audio";
const songs: Song[] = JSON.parse(
  readFileSync(new URL("../src/data/songs.json", import.meta.url), "utf8"),
).songs;
const song = songs.find((s) => s.title === "Miljacka")!;

test("catalog contains unique identities, artist coverage and playable pack sizes", () => {
  assert.equal(new Set(songs.map((s) => s.id)).size, songs.length);
  assert.equal(
    new Set(songs.map((s) => `${s.artist}|${s.title}`)).size,
    songs.length,
  );
  for (const pack of ["pop", "rock", "folk", "trap"])
    assert.ok(songs.filter((s) => s.category === pack).length >= 10);
});
test("answers ignore whitespace, case and accents but artist alone is a hint", () => {
  assert.equal(judgeGuess("  MILJACKA  ", song), "correct");
  assert.equal(judgeGuess("Halid Beslic - Miljacka", song), "correct");
  assert.equal(judgeGuess("Miljacka - Halid Beslic", song), "correct");
  assert.equal(judgeGuess("Halid Beslic", song), "artist");
  assert.equal(judgeGuess("Romanija", song), "wrong");
  assert.equal(judgeGuess("   ", song), "empty");
});
test("approved title aliases are accepted, provider live/remix versions are not", () => {
  const track = {
    id: 1,
    title: song.title,
    artist: { name: "Halid Beslic" },
    preview: "https://cdnt-preview.dzcdn.net/a.mp3",
  };
  assert.ok(matchTrack(song, track));
  assert.equal(matchTrack(song, { ...track, title: "Miljacka (Live)" }), false);
  assert.equal(
    matchTrack(song, { ...track, artist: { name: "Other artist" } }),
    false,
  );
  assert.equal(matchTrack(song, { ...track, preview: "" }), false);
  assert.equal(matchTrack(song, { ...track, readable: false }), false);
  assert.equal(safePreview("https://dzcdn.net.attacker.test/a"), false);
  assert.equal(safePreview("http://cdnt-preview.dzcdn.net/a"), false);
  assert.ok(safePreview(track.preview));
  const rose = songs.find((s) => s.title === "Mojoj majci")!;
  assert.equal(judgeGuess("Ruza hrvatska", rose), "correct");
});
test("daily selection is reproducible, genre-balanced and has five unique artists", () => {
  const a = makeSession(songs, "daily", "2026-10-05");
  const b = makeSession(songs, "daily", "2026-10-05");
  assert.deepEqual(a, b);
  assert.notDeepEqual(
    a.rounds,
    makeSession(songs, "daily", "2026-10-06").rounds,
  );
  const picked = a.rounds.map((r) => songs.find((s) => s.id === r.songId)!);
  assert.equal(new Set(picked.map((s) => s.artist)).size, 5);
  assert.equal(new Set(picked.map((s) => s.category)).size, 4);
});
test("practice is restricted to the selected pack and never duplicates a track", () => {
  const a = makeSession(songs, "practice", "2026-10-05", "rock", "one");
  assert.equal(a.rounds.length, 5);
  assert.ok(
    [...a.rounds.map((r) => r.songId), ...a.reserve].every(
      (id) => songs.find((s) => s.id === id)?.category === "rock",
    ),
  );
});
test("Sarajevo challenge dates and resets handle summer, winter and DST transitions", () => {
  assert.equal(dayKey(new Date("2026-10-05T22:01:00Z")), "2026-10-06");
  assert.equal(
    new Date(nextReset(new Date("2026-10-05T15:00:00Z"))).toISOString(),
    "2026-10-05T22:00:00.000Z",
  );
  assert.equal(
    new Date(nextReset(new Date("2026-01-05T15:00:00Z"))).toISOString(),
    "2026-01-05T23:00:00.000Z",
  );
  const spring = new Date("2026-03-28T23:00:00Z");
  assert.equal(nextReset(spring) - spring.getTime(), 23 * 3600000);
  const autumn = new Date("2026-10-24T22:00:00Z");
  assert.equal(nextReset(autumn) - autumn.getTime(), 25 * 3600000);
});
test("empty guesses preserve attempts; six failed guesses finish only one round", () => {
  let s = makeSession(songs, "daily", "2026-10-05");
  const current = songs.find((song) => song.id === s.rounds[0].songId)!;
  assert.equal(submitGuess(s, "", current).session, s);
  assert.equal(advance(s), s);
  for (let i = 0; i < 6; i++)
    s = submitGuess(s, "obviously incorrect", current).session;
  assert.equal(s.rounds[0].status, "lost");
  assert.equal(s.rounds[0].attempt, 5);
  assert.equal(s.index, 0);
  assert.equal(s.finished, false);
  assert.equal(submitGuess(s, current.title, current).session, s);
  assert.equal(advance(s).index, 1);
});
test("scores reward short snippets and double submission cannot award points twice", () => {
  let s = makeSession(songs, "daily", "2026-10-05");
  const current = songs.find((song) => song.id === s.rounds[0].songId)!;
  s = moreAudio(s);
  s = moreAudio(s);
  s = submitGuess(s, current.title, current).session;
  assert.equal(totalScore(s), 60);
  assert.equal(submitGuess(s, current.title, current).session, s);
  assert.equal(moreAudio(s), s);
});
test("artist hint consumes one attempt but never solves the song", () => {
  const s = makeSession(songs, "daily", "2026-10-05");
  const current = songs.find((song) => song.id === s.rounds[0].songId)!;
  const result = submitGuess(s, current.artist, current);
  assert.equal(result.verdict, "artist");
  assert.equal(result.session.rounds[0].status, "playing");
  assert.equal(result.session.rounds[0].attempt, 1);
});
test("unavailable audio is replaced without a failed round or lost points", () => {
  const s = makeSession(songs, "daily", "2026-10-05");
  const next = replaceUnavailable(moreAudio(s));
  assert.equal(next.rounds[0].songId, s.reserve[0]);
  assert.equal(next.rounds[0].attempt, 0);
  assert.equal(next.rounds[0].points, 0);
  assert.deepEqual(next.replaced, [s.rounds[0].songId]);
  assert.equal(
    parseSession(JSON.stringify(next), songs)?.rounds[0].songId,
    s.reserve[0],
  );
});
test("complete game survives reload with score, history, attempt and final reveal intact", () => {
  let s = makeSession(songs, "daily", "2026-10-05");
  for (let i = 0; i < 5; i++) {
    const current = songs.find((song) => song.id === s.rounds[s.index].songId)!;
    s = moreAudio(s);
    s = submitGuess(s, current.title, current).session;
    assert.equal(s.finished, false);
    const restored = parseSession(JSON.stringify(s), songs, s.id);
    assert.deepEqual(restored, s);
    s = advance(restored!);
  }
  assert.equal(s.finished, true);
  assert.equal(totalScore(s), 400);
  assert.deepEqual(parseSession(JSON.stringify(s), songs, s.id), s);
});
test("corrupt or stale storage cannot crash the game or leak into another daily challenge", () => {
  const s = makeSession(songs, "daily", "2026-10-05");
  assert.equal(parseSession("{broken", songs), null);
  assert.equal(parseSession(JSON.stringify(s), songs, "wrong-day"), null);
  assert.equal(parseSession(JSON.stringify({ ...s, index: 99 }), songs), null);
  assert.equal(
    parseSession(
      JSON.stringify({ ...s, rounds: [{ ...s.rounds[0], attempt: 7 }] }),
      songs,
    ),
    null,
  );
  assert.equal(
    parseSession(
      JSON.stringify({ ...s, rounds: [{ ...s.rounds[0], points: 999 }] }),
      songs,
    ),
    null,
  );
  assert.equal(
    parseSession(
      JSON.stringify({ ...s, reserve: [s.rounds[0].songId] }),
      songs,
    ),
    null,
  );
  assert.deepEqual(parseRecords("{bad"), {});
  assert.deepEqual(parseRecords('{"2026-10-05":{"score":99999}}'), {});
});
test("daily streak continues before today is played and breaks after a missed day", () => {
  const record = { score: 300, correct: 3, total: 5, replaced: false };
  const records = { "2026-10-03": record, "2026-10-04": record };
  assert.equal(streak(records, "2026-10-05"), 2);
  assert.equal(streak({ ...records, "2026-10-05": record }, "2026-10-05"), 3);
  assert.equal(streak(records, "2026-10-06"), 0);
});
test("all skip durations end at thirty seconds", () =>
  assert.deepEqual([...DURATIONS], [1, 3, 5, 10, 15, 30]));
