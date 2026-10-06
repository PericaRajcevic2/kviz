import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveAudio } from "../src/lib/resolve-audio";
import { matchTrack } from "../src/lib/audio";
import { makeSession, type Song } from "../src/lib/game";

const catalog: Song[] = JSON.parse(
  readFileSync("src/data/songs.json", "utf8"),
).songs;
const active = catalog.filter((song) => !song.audioUnavailable);
const song = active.find((song) => song.id === "dino-merlin-burek")!;
const track = {
  id: song.deezerId!,
  title: song.title,
  artist: { name: song.artist },
  preview: "https://cdnt-preview.dzcdn.net/preview.mp3?expires=1",
};

test("active catalog uses pinned recordings and excludes unavailable songs from all packs", () => {
  assert.equal(active.length, 142);
  assert.ok(active.every((song) => Number.isSafeInteger(song.deezerId)));
  for (const pack of ["mix", "pop", "rock", "folk", "trap"] as const) {
    for (let n = 0; n < 20; n++) {
      const session = makeSession(
        active,
        "practice",
        "2026-10-06",
        pack,
        String(n),
      );
      assert.equal(session.rounds.length, 5);
      assert.ok(
        [...session.rounds.map((r) => r.songId), ...session.reserve].every(
          (id) => active.some((song) => song.id === id),
        ),
      );
    }
  }
});

test("pinned recordings bypass search and refresh signed URLs without caching", async () => {
  const requests: { url: string; cache: RequestCache | undefined }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), cache: init?.cache });
    return Response.json({
      ...track,
      preview: track.preview.replace("expires=1", `expires=${requests.length}`),
    });
  };
  const first = await resolveAudio(song, fetcher);
  const second = await resolveAudio(song, fetcher);
  assert.notEqual(first?.url, second?.url);
  assert.deepEqual(
    requests.map((r) => r.url),
    Array(2).fill(`https://api.deezer.com/track/${song.deezerId}`),
  );
  assert.ok(requests.every((r) => r.cache === "no-store"));
});

test("provider API error inside HTTP 200 is not mistaken for a missing song", async () => {
  await assert.rejects(
    resolveAudio(song, async () =>
      Response.json({ error: { code: 4, message: "Quota" } }),
    ),
    /provider error/,
  );
});

test("search fallback remains strict about the artist and recording version", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () =>
    Response.json({
      data:
        ++calls === 1
          ? [{ ...track, title: `${song.title} (Live)` }]
          : [{ ...track, artist: { name: "Wrong artist" } }, track],
    });
  assert.equal(
    (await resolveAudio({ ...song, deezerId: undefined }, fetcher))?.source,
    `https://www.deezer.com/track/${song.deezerId}`,
  );
  assert.equal(calls, 2);
  assert.equal(
    await resolveAudio(song, async () =>
      Response.json({ ...track, title: "Other song" }),
    ),
    null,
  );
});

test("reviewed artist and full-title aliases match the intended recording", () => {
  const tony = active.find((s) => s.id === "toni-cetinski-kad-zena-zavoli")!;
  assert.ok(
    matchTrack(tony, {
      ...track,
      title: "Kad Žena Zavoli",
      artist: { name: "Tony Cetinski" },
    }),
  );
  const lipe = active.find((s) => s.id === "bijelo-dugme-lipe-cvatu")!;
  assert.ok(
    matchTrack(lipe, {
      ...track,
      title: "Lipe cvatu, sve je isto ko i lani",
      artist: { name: "Bijelo dugme" },
    }),
  );
});
