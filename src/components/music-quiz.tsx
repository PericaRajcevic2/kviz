"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { songs, songById } from "@/lib/catalog";
import {
  advance,
  dayKey,
  DURATIONS,
  judgeGuess,
  makeSession,
  moreAudio,
  nextReset,
  normalize,
  parseRecords,
  parseSession,
  POINTS,
  replaceUnavailable,
  streak,
  submitGuess,
  totalScore,
  type Pack,
  type Records,
  type Session,
} from "@/lib/game";
import { Icon } from "./icons";
import { useAudio } from "./use-audio";

const KEYS = {
  daily: "bns:daily:v2",
  practice: "bns:practice:v2",
  records: "bns:records:v2",
  volume: "bns:volume",
};
const PACKS: { id: Pack; title: string; subtitle: string; number: string }[] = [
  {
    id: "mix",
    title: "Balkanski miks",
    subtitle: "Od klasika do novih hitova",
    number: "01",
  },
  {
    id: "pop",
    title: "Pop hitovi",
    subtitle: "Znaš baš svaku riječ",
    number: "02",
  },
  {
    id: "rock",
    title: "Ex-Yu rock",
    subtitle: "Gitare koje ne stare",
    number: "03",
  },
  {
    id: "folk",
    title: "Kafanski klasici",
    subtitle: "Pjesme za cijeli sto",
    number: "04",
  },
  {
    id: "trap",
    title: "Novi zvuk",
    subtitle: "Trap, ritam i nova scena",
    number: "05",
  },
];
function countdown(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
function Vinyl({
  spinning = false,
  small = false,
}: {
  spinning?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`vinyl ${spinning ? "spinning" : ""} ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      <div className="vinyl-label">
        <span>BALKAN</span>
        <Icon name="music" size={small ? 22 : 32} />
        <span>NA SLUH · VOL. 02</span>
      </div>
      <div className="vinyl-hole" />
    </div>
  );
}
function Dialog({
  kind,
  close,
  records,
  today,
}: {
  kind: "help" | "stats";
  close: () => void;
  records: Records;
  today: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const entries = Object.values(records);
  const total = entries.reduce((sum, r) => sum + r.total, 0);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-labelledby="dialog-title"
    >
      <button
        className="icon-button dialog-close"
        onClick={close}
        aria-label="Zatvori"
      >
        <Icon name="close" />
      </button>
      <span className="eyebrow">
        {kind === "help" ? "BRZI VODIČ" : "TVOJ RITAM"}
      </span>
      <h2 id="dialog-title">
        {kind === "help"
          ? "Jedna sekunda je dovoljna?"
          : "Mala statistika. Veliki hitovi."}
      </h2>
      {kind === "help" ? (
        <>
          <ol className="rules">
            <li>
              <b>Poslušaj isječak.</b>
              <p>
                Počinješ s jednom sekundom. Isti isječak možeš poslušati ponovo.
              </p>
            </li>
            <li>
              <b>Pronađi pjesmu.</b>
              <p>
                Upiši naslov ili odaberi prijedlog. Kvačice nisu obavezne. Sam
                izvođač nije tačan odgovor.
              </p>
            </li>
            <li>
              <b>Treba ti još malo?</b>
              <p>
                Svaki netačan odgovor ili „Slušaj više” otključava duži isječak:
                1, 3, 5, 10, 15 i 30 sekundi.
              </p>
            </li>
          </ol>
          <div className="scoring">
            {POINTS.map((p, i) => (
              <span key={p}>
                <b>{DURATIONS[i]} s</b>
                {p} bod.
              </span>
            ))}
          </div>
          <p className="muted">
            Dnevni izazov ima pet pjesama i mijenja se u ponoć po vremenu u
            Sarajevu. Slobodnu igru možeš igrati koliko želiš.
          </p>
        </>
      ) : (
        <>
          <div className="stats-grid">
            <div>
              <strong>{entries.length}</strong>
              <span>završenih izazova</span>
            </div>
            <div>
              <strong>{streak(records, today)}</strong>
              <span>dana u nizu</span>
            </div>
            <div>
              <strong>
                {total
                  ? Math.round(
                      (entries.reduce((sum, r) => sum + r.correct, 0) / total) *
                        100,
                    )
                  : 0}
                %
              </strong>
              <span>pogođenih pjesama</span>
            </div>
            <div>
              <strong>
                {entries.length ? Math.max(...entries.map((r) => r.score)) : 0}
              </strong>
              <span>najbolji rezultat</span>
            </div>
          </div>
          <p className="muted">
            Statistika dnevnih izazova čuva se u ovom pregledniku. Slobodna igra
            ne utječe na niz.
          </p>
        </>
      )}
      <button className="button primary full" onClick={close}>
        {kind === "help" ? "Sve jasno, idemo!" : "Nazad na muziku"}
        <Icon name="arrow" />
      </button>
    </dialog>
  );
}
export default function MusicQuiz({ initialDay }: { initialDay: string }) {
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(initialDay);
  const [now, setNow] = useState(0);
  const [resetAt, setResetAt] = useState(0);
  const [view, setView] = useState<"home" | "game">("home");
  const [session, setSession] = useState<Session | null>(null);
  const [savedDaily, setSavedDaily] = useState<Session | null>(null);
  const [savedPractice, setSavedPractice] = useState<Session | null>(null);
  const [records, setRecords] = useState<Records>({});
  const [volume, setVolume] = useState(0.5);
  const [pack, setPack] = useState<Pack>("mix");
  const [dialog, setDialog] = useState<"help" | "stats" | null>(null);
  const [query, setQuery] = useState("");
  const [openSuggestions, setOpenSuggestions] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);
  const [feedback, setFeedback] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const [notice, setNotice] = useState("");
  const [shareText, setShareText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const searchBox = useRef<HTMLDivElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const round = session?.rounds[session.index];
  const song = round ? songById.get(round.songId) : undefined;
  const duration = DURATIONS[round?.attempt ?? 0];
  const audio = useAudio(
    view === "game" && !session?.finished ? song?.id : undefined,
    duration,
    volume,
  );
  const stopAudio = audio.stop;
  const canGuess = audio.status === "ready";
  const matches =
    query.trim().length >= 2
      ? songs
          .filter((s) =>
            normalize(
              `${s.artist} ${s.title} ${(s.aliases ?? []).join(" ")}`,
            ).includes(normalize(query)),
          )
          .slice(0, 7)
      : [];

  useEffect(() => {
    const date = dayKey();
    setToday(date);
    setNow(Date.now());
    setResetAt(nextReset());
    try {
      setSavedDaily(
        parseSession(
          localStorage.getItem(KEYS.daily),
          songs,
          makeSession(songs, "daily", date).id,
        ),
      );
      setSavedPractice(
        parseSession(localStorage.getItem(KEYS.practice), songs),
      );
      setRecords(parseRecords(localStorage.getItem(KEYS.records)));
      const raw = localStorage.getItem(KEYS.volume);
      const stored = Number(raw);
      if (raw !== null && Number.isFinite(stored) && stored >= 0 && stored <= 1)
        setVolume(stored);
    } catch {
      setStorageWarning(true);
    }
    setReady(true);
    const timer = setInterval(() => {
      setNow(Date.now());
      setToday(dayKey());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!ready) return;
    setResetAt(nextReset());
    if (savedDaily && savedDaily.day !== today) setSavedDaily(null);
    if (session?.mode === "daily" && session.day !== today) {
      setSession(null);
      setView("home");
      setNotice("Novi dan, novi hitovi. Današnji izazov je spreman.");
    }
    // Only the date transition should reset an active daily session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, ready]);
  useEffect(() => {
    if (!ready || !session) return;
    if (session.mode === "daily") setSavedDaily(session);
    else setSavedPractice(session);
    try {
      localStorage.setItem(KEYS[session.mode], JSON.stringify(session));
    } catch {
      setStorageWarning(true);
    }
    if (session.mode === "daily" && session.finished) {
      setRecords((previous) => {
        const next = {
          ...previous,
          [session.day]: {
            score: totalScore(session),
            correct: session.rounds.filter((r) => r.status === "won").length,
            total: session.rounds.length,
            replaced: session.replaced.length > 0,
          },
        };
        const trimmed = parseRecords(JSON.stringify(next));
        try {
          localStorage.setItem(KEYS.records, JSON.stringify(trimmed));
        } catch {
          setStorageWarning(true);
        }
        return trimmed;
      });
    }
  }, [session, ready]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(KEYS.volume, String(volume));
      } catch {
        setStorageWarning(true);
      }
  }, [volume, ready]);
  useEffect(() => {
    setQuery("");
    setFeedback("");
    setOpenSuggestions(false);
    setActiveOption(-1);
    setShareText("");
  }, [song?.id, view]);
  useEffect(() => {
    if (round?.status !== "playing" || session?.finished) {
      stopAudio();
      resultHeading.current?.focus();
    }
  }, [round?.status, session?.finished, stopAudio]);
  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (!searchBox.current?.contains(e.target as Node))
        setOpenSuggestions(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);
  function startDaily() {
    setSession(savedDaily ?? makeSession(songs, "daily", today));
    setView("game");
    setNotice("");
  }
  function startPractice(resume = false) {
    setSession(
      resume && savedPractice
        ? savedPractice
        : makeSession(songs, "practice", today, pack, crypto.randomUUID()),
    );
    setView("game");
    setNotice("");
  }
  function home() {
    audio.stop();
    setView("home");
    setFeedback("");
  }
  function guess() {
    if (!session || !song || !canGuess) return;
    if (judgeGuess(query, song) === "empty") {
      setFeedback("Prvo upiši naslov ili odaberi pjesmu.");
      input.current?.focus();
      return;
    }
    audio.stop();
    const result = submitGuess(session, query.slice(0, 240), song);
    setSession(result.session);
    setQuery("");
    setOpenSuggestions(false);
    setActiveOption(-1);
    setFeedback(
      result.verdict === "artist"
        ? "Izvođač je tačan! Sada tražimo naslov pjesme."
        : result.verdict === "wrong"
          ? "Nije ta pjesma. Otključan je duži isječak."
          : "",
    );
  }
  function listenMore() {
    if (!session || !canGuess) return;
    audio.stop();
    setSession(moreAudio(session));
    setFeedback("");
    setQuery("");
    setOpenSuggestions(false);
  }
  async function share() {
    if (!session) return;
    const marks = session.rounds
      .map((r) => (r.status === "won" ? `🟩 ${DURATIONS[r.attempt]} s` : "⬛"))
      .join(" · ");
    const text = `Balkan na sluh · ${session.mode === "daily" ? session.day : "Slobodna igra"}\n${totalScore(session)}/${session.rounds.length * 100} bodova\n${marks}${session.replaced.length ? "\nUz zamjenske pjesme" : ""}\n${window.location.origin}`;
    try {
      await navigator.clipboard.writeText(text);
      setFeedback("Rezultat je kopiran — pošalji ga ekipi!");
    } catch {
      setShareText(text);
      setFeedback("Kopiraj tekst ispod i podijeli rezultat.");
    }
  }
  const dailyScore = savedDaily?.finished ? totalScore(savedDaily) : null;
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main">
        Preskoči na sadržaj
      </a>
      <header className="site-header">
        <button
          className="brand"
          onClick={home}
          aria-label="Balkan na sluh — početna"
        >
          <span className="brand-icon">
            <Icon name="headphones" size={26} />
          </span>
          <span>
            BALKAN
            <span className="brand-bottom">
              NA SLUH<span className="brand-dot">●</span>
            </span>
          </span>
        </button>
        <nav aria-label="Glavna navigacija">
          <button onClick={() => setDialog("help")}>
            <span className="help-symbol">?</span>
            <span>Kako se igra</span>
          </button>
          <button
            onClick={() => setDialog("stats")}
            aria-label="Moja statistika"
          >
            <Icon name="stats" />
            <span>Moja statistika</span>
          </button>
        </nav>
      </header>
      {storageWarning && (
        <div className="notice warning" role="status">
          Preglednik ne dopušta spremanje. Možeš igrati, ali napredak možda neće
          ostati nakon zatvaranja.
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      <main id="main">
        {view === "home" ? (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="live-dot" /> TVOJA MUZIKA. TVOJ KVIZ.
                </div>
                <h1>
                  Znaš je.
                  <br />
                  Ali koliko <span>brzo?</span>
                </h1>
                <p>
                  Jedna sekunda. Poznat zvuk.
                  <br />
                  Pogodi balkanske hitove i pokaži koliko ti malo treba.
                </p>
                <div className="hero-actions">
                  <button
                    className="button primary"
                    disabled={!ready}
                    onClick={startDaily}
                  >
                    {savedDaily?.finished
                      ? "Pogledaj rezultat"
                      : savedDaily
                        ? "Nastavi izazov"
                        : "Zaigraj dnevni izazov"}
                    <Icon name="arrow" />
                  </button>
                  <a className="text-link" href="#slobodna">
                    Ili složi svoj miks
                    <Icon name="shuffle" size={17} />
                  </a>
                </div>
                <div className="hero-proof">
                  <span>
                    <Icon name="headphones" size={16} /> Bez registracije
                  </span>
                  <i />
                  <span>5 pjesama · 6 pokušaja</span>
                </div>
              </div>
              <div className="record-scene">
                <div className="scene-grid" />
                <span className="scene-top">DOBAR SLUH. DOBAR UKUS.</span>
                <div className="record-sleeve">
                  <span className="sleeve-type">
                    NA
                    <br />
                    SLUH.
                  </span>
                  <span className="sleeve-caption">
                    BALKANSKI HITOVI
                    <br />
                    OD PRVE SEKUNDE.
                  </span>
                  <span className="sleeve-star">✳</span>
                </div>
                <Vinyl />
                <div className="scene-sticker">
                  <Icon name="play" size={18} />
                  <span>
                    SAMO
                    <br />
                    <b>1 SEKUNDA</b>
                  </span>
                </div>
                <span className="scene-bottom">
                  SIDE A — TVOJ SLJEDEĆI OMILJENI KVIZ
                </span>
              </div>
            </section>
            <section className="daily-strip" aria-label="Današnji izazov">
              <div className="daily-icon">
                <Icon name="calendar" size={25} />
              </div>
              <div>
                <span className="eyebrow">SVAKI DAN NOVI HITOVI</span>
                <h2>
                  Dnevni izazov{" "}
                  <span>{today.split("-").reverse().join(".")}</span>
                </h2>
                <p>
                  {dailyScore !== null
                    ? `Tvoj rezultat: ${dailyScore}/500 bodova. Za još muzike tu je slobodna igra.`
                    : "Iste pjesme za sve. Koliko ih ti prepoznaješ?"}
                </p>
              </div>
              <div className="daily-countdown">
                <span>
                  <Icon name="clock" size={14} /> Novi izazov za
                </span>
                <b>{ready ? countdown(resetAt - now) : "—:—:—"}</b>
              </div>
              <button
                className="circle-button"
                disabled={!ready}
                onClick={startDaily}
                aria-label={
                  savedDaily?.finished
                    ? "Otvori dnevni rezultat"
                    : "Otvori dnevni izazov"
                }
              >
                <Icon name="arrow" />
              </button>
            </section>
            <section className="practice-section" id="slobodna">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">BEZ ČEKANJA DO SUTRA</span>
                  <h2>Tvoj miks. Tvoja pravila.</h2>
                </div>
                <p>Odaberi svoj zvuk i igraj koliko želiš.</p>
              </div>
              <div
                className="pack-grid"
                role="radiogroup"
                aria-label="Muzički paket"
              >
                {PACKS.map((p, index) => (
                  <button
                    key={p.id}
                    role="radio"
                    aria-checked={pack === p.id}
                    tabIndex={pack === p.id ? 0 : -1}
                    onKeyDown={(event) => {
                      const offsets: Record<string, number> = {
                        ArrowRight: 1,
                        ArrowDown: 1,
                        ArrowLeft: -1,
                        ArrowUp: -1,
                      };
                      if (!(event.key in offsets)) return;
                      event.preventDefault();
                      const next =
                        (index + offsets[event.key] + PACKS.length) %
                        PACKS.length;
                      setPack(PACKS[next].id);
                      const buttons =
                        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                          '[role="radio"]',
                        );
                      buttons?.[next]?.focus();
                    }}
                    className={`pack-card pack-${p.id} ${pack === p.id ? "selected" : ""}`}
                    onClick={() => setPack(p.id)}
                  >
                    <span className="pack-top">
                      <span>{p.number}</span>
                      <span className="radio-dot">
                        {pack === p.id && <Icon name="check" size={12} />}
                      </span>
                    </span>
                    <div className="pack-art" aria-hidden="true">
                      {p.id === "mix" ? (
                        <Icon name="shuffle" size={38} />
                      ) : p.id === "rock" ? (
                        <span>⚡</span>
                      ) : p.id === "folk" ? (
                        <span>♫</span>
                      ) : p.id === "trap" ? (
                        <div className="mini-bars">
                          {[2, 4, 3, 5, 2, 4, 3].map((h, i) => (
                            <i key={i} style={{ height: h * 9 }} />
                          ))}
                        </div>
                      ) : (
                        <div className="pop-disc" />
                      )}
                    </div>
                    <b>{p.title}</b>
                    <span className="pack-subtitle">{p.subtitle}</span>
                  </button>
                ))}
              </div>
              <div className="practice-actions">
                <span>
                  <Icon name="music" size={17} />
                  {
                    songs.filter((s) => pack === "mix" || s.category === pack)
                      .length
                  }{" "}
                  pjesama u katalogu · 5 po igri
                </span>
                <div>
                  {savedPractice && !savedPractice.finished && (
                    <button
                      className="text-link"
                      disabled={!ready}
                      onClick={() => startPractice(true)}
                    >
                      Nastavi prethodnu
                    </button>
                  )}
                  <button
                    className="button dark"
                    disabled={!ready}
                    onClick={() => startPractice()}
                  >
                    Pokreni slobodnu igru
                    <Icon name="arrow" />
                  </button>
                </div>
              </div>
            </section>
            <section className="how-strip">
              <span className="eyebrow">JEDNOSTAVNO KAO REFREN</span>
              <div>
                <b>
                  <span>01</span> Poslušaj.
                </b>
                <p>Počni s jednom sekundom.</p>
              </div>
              <div>
                <b>
                  <span>02</span> Prepoznaj.
                </b>
                <p>Upiši pjesmu koju čuješ.</p>
              </div>
              <div>
                <b>
                  <span>03</span> Ponovi.
                </b>
                <p>Manje slušanja, više bodova.</p>
              </div>
            </section>
          </>
        ) : (
          session &&
          song &&
          round && (
            <section className="game-page">
              <div className="game-nav">
                <button className="text-link" onClick={home}>
                  <Icon name="back" size={17} />
                  Početna
                </button>
                <span className="eyebrow">
                  {session.mode === "daily"
                    ? "DNEVNI IZAZOV"
                    : PACKS.find(
                        (p) => p.id === session.pack,
                      )?.title.toUpperCase()}
                  <span className="nav-date">
                    {" "}
                    / {session.day.split("-").reverse().join(".")}
                  </span>
                </span>
                <button
                  className="icon-button"
                  onClick={() => setDialog("help")}
                  aria-label="Pravila igre"
                >
                  ?
                </button>
              </div>
              {session.finished ? (
                <div className="summary-card">
                  <span className="eyebrow">MIKS JE ODSLUŠAN</span>
                  <h1 ref={resultHeading} tabIndex={-1}>
                    {totalScore(session) >= 400
                      ? "Imaš uho za hitove."
                      : totalScore(session) > 0
                        ? "Dobar ritam. Još bolji pokušaj slijedi."
                        : "Svaki hit ima svoj trenutak."}
                  </h1>
                  <p className="muted">
                    Pogodio/la si{" "}
                    {session.rounds.filter((r) => r.status === "won").length} od{" "}
                    {session.rounds.length} pjesama.
                  </p>
                  <div className="score-display">
                    {totalScore(session)}
                    <span>
                      /{session.rounds.length * 100}
                      <small>BODOVA</small>
                    </span>
                  </div>
                  <div className="round-results">
                    {session.rounds.map((r, i) => {
                      const s = songById.get(r.songId)!;
                      return (
                        <div key={r.songId}>
                          <span className="result-number">0{i + 1}</span>
                          <span className={`result-status ${r.status}`}>
                            <Icon
                              name={r.status === "won" ? "check" : "close"}
                              size={16}
                            />
                          </span>
                          <span className="result-song">
                            <b>{s.title}</b>
                            <small>{s.artist}</small>
                          </span>
                          <span className="result-points">
                            {r.points}
                            <small>
                              {r.status === "won"
                                ? `${DURATIONS[r.attempt]} s`
                                : "nije pogođeno"}
                            </small>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {session.replaced.length > 0 && (
                    <p className="muted small-text">
                      Odigrano uz zamjenske pjesme zbog nedostupnog zvuka. Set
                      se može razlikovati od rezultata prijatelja.
                    </p>
                  )}
                  <div className="summary-actions">
                    <button
                      className="button primary"
                      onClick={() => startPractice()}
                    >
                      Još jedan miks
                      <Icon name="arrow" />
                    </button>
                    <button className="button secondary" onClick={share}>
                      <Icon name="share" />
                      Podijeli rezultat
                    </button>
                  </div>
                  <p role="status" className="feedback">
                    {feedback}
                  </p>
                  {shareText && (
                    <textarea
                      className="share-text"
                      readOnly
                      value={shareText}
                      aria-label="Rezultat za kopiranje"
                      onFocus={(e) => e.target.select()}
                    />
                  )}
                  <p className="summary-note">
                    {session.mode === "daily"
                      ? `Novi dnevni izazov za ${countdown(resetAt - now)}. Slobodna igra je uvijek tu.`
                      : "Još pet pjesama? Odaberi novi paket na početnoj."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="game-topline">
                    <div>
                      <span className="eyebrow">POKAŽI KOLIKO ZNAŠ</span>
                      <h1>
                        Pjesma {session.index + 1}
                        <span> / {session.rounds.length}</span>
                      </h1>
                    </div>
                    <div className="points-pill">
                      <Icon name="spark" size={17} />
                      <b>{totalScore(session)}</b>
                      <span>bodova</span>
                    </div>
                  </div>
                  <div className="round-dots" aria-label="Napredak igre">
                    {session.rounds.map((r, i) => (
                      <span
                        key={i}
                        className={`${r.status} ${i === session.index ? "current" : ""}`}
                        aria-label={`Pjesma ${i + 1}: ${r.status === "won" ? "pogođena" : r.status === "lost" ? "nije pogođena" : i === session.index ? "trenutna" : "slijedi"}`}
                      >
                        {r.status === "won" ? (
                          <Icon name="check" size={14} />
                        ) : r.status === "lost" ? (
                          <Icon name="close" size={14} />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="game-card">
                    {round.status === "playing" ? (
                      <>
                        <div className="player-head">
                          <span className="tag">
                            POKUŠAJ {round.attempt + 1} / 6
                          </span>
                          <span>
                            Ovaj pogodak vrijedi{" "}
                            <b>{POINTS[round.attempt]} bodova</b>
                          </span>
                        </div>
                        <div className="player-visual">
                          <Vinyl small spinning={audio.playing} />
                          <div
                            className={`waveform ${audio.playing ? "active" : ""}`}
                            aria-hidden="true"
                          >
                            {Array.from({ length: 29 }, (_, i) => (
                              <i
                                key={i}
                                style={{
                                  height: 12 + ((i * 17 + 7) % 37),
                                  animationDelay: `${i * 0.05}s`,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        <h2 className="player-title">
                          {audio.status === "error"
                            ? "Mala pauza u programu."
                            : audio.status === "loading"
                              ? "Pripremamo zvuk…"
                              : round.attempt === 0
                                ? "Prepoznaješ li je iz prve?"
                                : "Još malo zvuka. Znaš li sada?"}
                        </h2>
                        <p className="player-caption">
                          {audio.status === "loading"
                            ? "Tražimo odgovarajuću verziju pjesme."
                            : audio.status === "error"
                              ? "Tvoji bodovi i pokušaji su sačuvani."
                              : `Dostupno ${duration} ${duration === 1 ? "sekunda" : "sekundi"} · ponovi slušanje koliko želiš`}
                        </p>
                        {audio.status === "error" ? (
                          <div className="audio-error" role="alert">
                            <p>{audio.error}</p>
                            <div>
                              <button
                                className="button secondary"
                                onClick={audio.retry}
                              >
                                <Icon name="refresh" size={17} />
                                Pokušaj ponovo
                              </button>
                              <button
                                className="button dark"
                                disabled={!session.reserve.length}
                                onClick={() => {
                                  setSession(replaceUnavailable(session));
                                  setFeedback("");
                                }}
                              >
                                Zamijeni pjesmu
                                <Icon name="shuffle" size={17} />
                              </button>
                            </div>
                            {!session.reserve.length && (
                              <p>
                                Nema više zamjenskih pjesama. Pokušaj kasnije
                                ili odaberi drugi paket.
                              </p>
                            )}
                          </div>
                        ) : (
                          <button
                            className="listen-button"
                            onClick={audio.toggle}
                            disabled={audio.status !== "ready"}
                            aria-label={
                              audio.playing
                                ? "Pauziraj isječak"
                                : `Poslušaj ${duration} sekundi`
                            }
                          >
                            <Icon
                              name={audio.playing ? "pause" : "play"}
                              size={22}
                            />
                            {audio.playing
                              ? "Slušamo…"
                              : audio.elapsed > 0
                                ? "Poslušaj ponovo"
                                : `Poslušaj ${duration} s`}
                          </button>
                        )}
                        <div className="audio-timeline">
                          <div className="timeline-track">
                            <span
                              className="timeline-unlocked"
                              style={{ width: `${(duration / 30) * 100}%` }}
                            />
                            <span
                              className="timeline-played"
                              style={{
                                width: `${(audio.elapsed / 30) * 100}%`,
                              }}
                            />
                          </div>
                          <div className="timeline-label">
                            <span>{audio.elapsed.toFixed(1)} s</span>
                            <span>30 s</span>
                          </div>
                        </div>
                        <div
                          className="duration-steps"
                          aria-label="Trajanje pokušaja"
                        >
                          {DURATIONS.map((d, i) => (
                            <span
                              key={d}
                              className={
                                i === round.attempt
                                  ? "current"
                                  : i < round.attempt
                                    ? "past"
                                    : ""
                              }
                            >
                              {d} s
                            </span>
                          ))}
                        </div>
                        <div className="answer-area" ref={searchBox}>
                          <label htmlFor="song-answer">
                            Koja je ovo pjesma?
                          </label>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              guess();
                            }}
                          >
                            <div className="answer-input">
                              <Icon name="search" />
                              <input
                                id="song-answer"
                                ref={input}
                                role="combobox"
                                aria-autocomplete="list"
                                aria-expanded={
                                  openSuggestions && matches.length > 0
                                }
                                aria-controls="song-options"
                                aria-activedescendant={
                                  openSuggestions && activeOption >= 0
                                    ? `song-option-${activeOption}`
                                    : undefined
                                }
                                value={query}
                                maxLength={240}
                                placeholder="Upiši naslov ili izvođača…"
                                autoComplete="off"
                                disabled={!canGuess}
                                onChange={(e) => {
                                  setQuery(e.target.value);
                                  setOpenSuggestions(true);
                                  setActiveOption(-1);
                                }}
                                onFocus={() => setOpenSuggestions(true)}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    setOpenSuggestions(false);
                                    setActiveOption(-1);
                                  }
                                  if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    setOpenSuggestions(true);
                                    setActiveOption((i) =>
                                      Math.min(i + 1, matches.length - 1),
                                    );
                                  }
                                  if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    setActiveOption((i) => Math.max(i - 1, 0));
                                  }
                                  if (
                                    e.key === "Enter" &&
                                    openSuggestions &&
                                    matches[activeOption]
                                  ) {
                                    e.preventDefault();
                                    setQuery(
                                      `${matches[activeOption].artist} - ${matches[activeOption].title}`,
                                    );
                                    setOpenSuggestions(false);
                                    setActiveOption(-1);
                                  }
                                }}
                              />
                              <button
                                className="submit-answer"
                                type="submit"
                                disabled={!canGuess || !query.trim()}
                                aria-label="Potvrdi odgovor"
                              >
                                <Icon name="arrow" />
                              </button>
                            </div>
                            {openSuggestions && query.trim().length >= 2 && (
                              <ul
                                className="suggestions"
                                id="song-options"
                                role="listbox"
                                aria-label="Prijedlozi pjesama"
                              >
                                {matches.length ? (
                                  matches.map((s, i) => (
                                    <li
                                      key={s.id}
                                      id={`song-option-${i}`}
                                      role="option"
                                      aria-selected={i === activeOption}
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        setQuery(`${s.artist} - ${s.title}`);
                                        setOpenSuggestions(false);
                                        setActiveOption(-1);
                                        input.current?.focus();
                                      }}
                                    >
                                      <span className="suggestion-icon">
                                        <Icon name="music" size={17} />
                                      </span>
                                      <span>
                                        <b>{s.title}</b>
                                        <small>{s.artist}</small>
                                      </span>
                                      <Icon name="arrow" size={16} />
                                    </li>
                                  ))
                                ) : (
                                  <li
                                    className="no-matches"
                                    role="option"
                                    aria-selected="false"
                                  >
                                    Nema prijedloga. Možeš potvrditi upisani
                                    naslov.
                                  </li>
                                )}
                              </ul>
                            )}
                          </form>
                        </div>
                        <div className="answer-footer">
                          <span>Kvačice nisu obavezne.</span>
                          <button
                            className="text-link"
                            disabled={!canGuess}
                            onClick={listenMore}
                          >
                            {round.attempt < 5
                              ? `Slušaj više · ${DURATIONS[round.attempt + 1]} s`
                              : "Otkrij pjesmu"}
                            <Icon name="arrow" size={16} />
                          </button>
                        </div>
                        <p
                          className={`feedback ${feedback ? "visible" : ""}`}
                          role="status"
                        >
                          {feedback}
                        </p>
                        {round.guesses.length > 0 && (
                          <div
                            className="guess-history"
                            aria-label="Prethodni pokušaji"
                          >
                            {round.guesses.map((g, i) => (
                              <div key={i}>
                                <span>{DURATIONS[i]} s</span>
                                <Icon
                                  name={
                                    g.kind === "more"
                                      ? "clock"
                                      : g.kind === "artist"
                                        ? "music"
                                        : "close"
                                  }
                                  size={15}
                                />
                                <span>{g.text}</span>
                                {g.kind === "artist" && (
                                  <small>Tačan izvođač</small>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="volume-row">
                          <Icon name="volume" size={17} />
                          <label htmlFor="volume">Glasnoća</label>
                          <input
                            id="volume"
                            type="range"
                            min="0"
                            max="1"
                            step=".01"
                            value={volume}
                            onChange={(e) => setVolume(Number(e.target.value))}
                          />
                          <span>{Math.round(volume * 100)}%</span>
                        </div>
                      </>
                    ) : (
                      <div className="reveal">
                        <span className={`reveal-badge ${round.status}`}>
                          <Icon
                            name={round.status === "won" ? "check" : "music"}
                            size={22}
                          />
                        </span>
                        <span className="eyebrow">
                          {round.status === "won"
                            ? "TO JE TA PJESMA!"
                            : "SADA ĆEŠ JE ZAPAMTITI"}
                        </span>
                        {audio.data?.image ? (
                          <Image
                            unoptimized
                            className="album-art"
                            src={audio.data.image}
                            alt={`Omot: ${song.title}`}
                            width="160"
                            height="160"
                          />
                        ) : (
                          <Vinyl small />
                        )}
                        <h2 ref={resultHeading} tabIndex={-1}>
                          {song.title}
                        </h2>
                        <p>{song.artist}</p>
                        <div className="reveal-points">
                          {round.status === "won"
                            ? `+${round.points} bodova`
                            : "Sljedeći hit je nova prilika."}
                          {round.status === "won" && (
                            <small>Prepoznato uz {duration} s zvuka</small>
                          )}
                        </div>
                        {audio.data?.source && (
                          <a
                            className="text-link source-link"
                            href={audio.data.source}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Poslušaj na Deezeru
                            <Icon name="external" size={14} />
                          </a>
                        )}
                        <button
                          className="button primary full"
                          onClick={() => {
                            setSession(advance(session));
                            setFeedback("");
                          }}
                        >
                          {session.index === session.rounds.length - 1
                            ? "Pogledaj rezultat"
                            : "Sljedeća pjesma"}
                          <Icon name="arrow" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="game-footnote">
                    <Icon name="headphones" size={15} /> Poznat zvuk. Dobar
                    osjećaj.
                  </p>
                </>
              )}
              {audio.data && !session.finished && (
                <audio
                  key={song.id}
                  ref={audio.ref}
                  src={audio.data.url}
                  preload="auto"
                  onError={audio.playbackError}
                  onEnded={audio.stop}
                />
              )}
            </section>
          )
        )}
      </main>
      <footer className="site-footer">
        <span>
          BALKAN NA SLUH<span className="brand-dot">●</span>
        </span>
        <p>Napravljeno za dobru muziku i još bolju ekipu.</p>
        <small>© {today.slice(0, 4)} Perica Rajčević</small>
      </footer>
      {dialog && (
        <Dialog
          kind={dialog}
          close={() => setDialog(null)}
          records={records}
          today={today}
        />
      )}
    </div>
  );
}
