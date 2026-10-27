# Changelog

## 0.1.18

- **He keeps the thread, part two (two context errors from real use).**
  - After a check with an open step, "wie mache ich den Schritt?" / "what should I do now?" / "¿cómo lo arreglo?" no longer starts a new
    check: he explains the open step(s) from the last result (what, why, the exact commands), changes nothing, and says "fix" starts the
    plan with your yes.
  - After he showed a numbered list ("which one: 1) this machine 2) all …"), "prüfe die 4" / "check number 3" belongs to *that* list, also
    when another question was in between. An address or a version number ("php 8.3") is never taken for a list number.

## 0.1.17

- **`dante` as a command.** `npm install -g dante-watch` now gives you `dante` (and still `dante-watch`): summon him with one word,
  like Virgil. Without installing, `npx dante-watch` works as before. Note: `npx dante` is a *different* package on npm (not ours) -
  always use `npx dante-watch`.

## 0.1.16

- **Fix: SSH was called safe with password login on.** The SSH check only warned when root login *and* password login were
  both open; password login alone passed as "safe" with the line "SSH is not the open brute-force door". Now "safe" needs
  every listed setting closed; if one is open the verdict is a step needed, with the real `sshd -T` lines.
- **Windows, step one.** Dante recognises Windows at start and says plainly what he can and cannot do there. The checks for
  SSH settings, web folders (IIS, XAMPP, WAMP, Laragon), readable secrets, webshell patterns and "writable by everyone" now run
  in plain Node on this machine (new `src/core/fsx.mjs`, "the house engine"): no bash needed, no path turns into a command.
  On a server over ssh the same questions are still asked as shell commands. For every question the engine and the shell are
  tested to give the same answer on the same folder. On Windows he also reads the PHP version (by version number, since Windows PHP has no distro backports), runs
  the deep run (keys in code, git state via `git`), recognises the system (Windows desktop vs Server) and works with your servers and
  keys through `ssh.exe`; `scharf` uses `schtasks` (untested on a real Windows). What he cannot do yet there (the "writable by everyone" search,
  open ports, running processes) he reports as unknown, never as safe. Windows is tested in CI on a real Windows runner.
- **Who may read his files.** `~/.dante/` (token, user.md, diary, scripts) is locked to the owner: file modes on macOS and
  Linux, `icacls` on Windows. If it cannot be read on a system, the answer is "unknown", not a promise.
- **He keeps the thread.** The conversation has a memory of the last 100 lines. He no longer asks the same question back
  twice in a row, guesses only when he is reasonably close (30 %), asks a long rambling line to be said in one sentence, and can
  answer "what did I say a moment ago" and "where in the code does it say you only read".
- **Smarter ears.** The language library grew by about 120,000 checked lines (German, English, Spanish in equal parts, from
  hard simulated users). Lines where two ears disagree on the label were left out on purpose.
- **A pack that has run out** is said at the start and, at most once a day, he offers to open the shop page; the command that opens it is shown first and runs only after a yes.
- **Fixes:** the German word "los" no longer switches the language to Spanish; model names and the git lookup work with
  Windows paths; `~` before a backslash.
- **Building blocks, not wired yet:** an inventory of the ways in (open ports, autostart places, mail, old files) for macOS,
  Linux and Windows, knowledge cards for them, a daily appearance and a report for your AI (`src/ways/`).

## 0.1.4 (unreleased)

_0.1.2 shipped the Virgil-style interface. 0.1.3 (published 26 Oct, night) brought the first meeting, the schedule, the deep run, the Prüf-Bib and the Hugging Face analysis. This version adds the system and server knowledge: finding servers (also in the shell history), system information and "what is going on", the host-key check, plural questions ("my servers") and the fixes found by checking Dante against real servers._

- **Virgil's look, one to one, for Dante.** The start is no longer a yes/no door: Dante is awake the moment
  you summon him. You see the sword-carrying Dante (a new sprite, drawn in Virgil's half-block style), the
  **DANTE lettering** in teal, and a loading screen — a bar that fills as his ears really wake — before
  `● wach` and the chat. Under the chat sits Virgil's **pinned footer**: a thin line and a GTA-loading-screen
  tip that changes with every input, plus Dante's inner clock and the running version on the right
  (`bib 25.10. · 0d · v0.1.2`). While a check waits for the server, Virgil's **waiting screen** runs: a block
  swinging in a bar, a dinosaur running beside it, the name of the step, the seconds and, after a few seconds,
  a saying in Dante's voice (German, English, Spanish). It all comes from the `~/dante` fork of Virgil's UI.
- **The waiting screen really moves.** The checks block while ssh waits, so they now run in a worker thread
  and the pack fetch runs without blocking; the main thread keeps the animation going.
- **Start in about 3 seconds, as before.** Only the two ears every start needs are woken in the loading screen;
  the three specialist ears (patrol, system, explain) wake the first time they are asked.
- **The terminal always comes back:** the footer's scroll region is reset on `raus`, Ctrl-D and Ctrl-C
  (proven in a real pseudo-terminal), or the screen would stay frozen.
- **`--version` / `-v`**, and the version in the clock line, so nobody has to guess which one runs.
- **The first meeting (`~/.dante/user.md`).** On the first start Dante asks *"Ah — here I have landed. May I look
  around?"* (in the person's language). On a clear yes he looks, read-only and on this machine only: the system, the
  Git name, the hosts of `~/.ssh/config` and `known_hosts`, the names of project folders. He tells what he saw, asks
  "you are probably X — right?", can knock at the servers he found (separate yes, read-only, the person's own key) to
  learn what runs there, and notes everything in `user.md`, plain Markdown the person may change. The input line is now
  `user ❯`: it is the person who types there.
- **Armed — a schedule, four times a day.** Only after a separate clear yes, with the file or cron line shown first,
  he writes a launchd agent (Mac) or a cron block (elsewhere) that starts `dante-watch --patrol` at 00/06/12/18 h.
  A patrol runs the whole battery on this machine and on the approved servers, writes the diary and notes what changed
  since the run before; it changes nothing and calls nobody (only SSH to those servers). `abschalten` / `disarm` /
  `desarmar` removes it; the small script it starts is rewritten at every start so it follows the version that runs.
- **"What happened?"** — a diary (`~/.dante/diary.jsonl`) of runs, visits and what he did (looked around, armed,
  installed packs, closed a hole). Asked in free words in German, English or Spanish (a new ear intent, 86 %), he
  answers from it in four lines: runs since the last visit, what is new, what is open, what he did. At start he says
  "welcome back" with the same report. "Armed" in free words ("schalt dich bitte scharf") can no longer be heard as
  "end the session": a hard bolt on schedule words.
- **His own clock for `user.md` (20 days) — and `update` does both.** `user.md` carries `aktualisiert:`; after 20
  days he asks whether to look again and then fetches the packs; a no is remembered and he does not ask again for 3
  days. The new merge keeps what the person has (a server in the patrol, notes), adds what is new, and new servers join
  the patrol only after a yes. `update` now does the same refresh next to fetching the packs.
- **A buying nudge that only speaks when there is something to buy.** With knowledge 30 days old (once a week at most)
  or on `kaufen` / `buy` / `comprar`, he offers one `curl` to the **public** catalog (no token, nothing of the person).
  Only if there are packs the person lacks does he name them with their price and ask whether to open the shop page.
- **The language is never guessed wrong.** `LANG` says `en_US` in most terminals, so a clear non-English signal beats
  an English one and, on a Mac, the system languages count; `language de|en|es` (`sprache`, `idioma`) sets it for good.
  Everything stays local.
- **The deep run and the Prüf-Bib.** New rule type `secret_format` and a library of secret formats per system, written
  by DeepSeek in the kitchen and verified by the real `grep` (each format against its own matching and non-matching
  samples, against a corpus of ordinary library code, and against the client schema), measured at every stage on a
  fixed test stand with planted secrets and lookalikes. The router looks for the systems present (node, php, python, go,
  ruby, java, rust, apple, linux, web) and runs only their formats. A hit is drilled into (rights, Git: tracked, was ever
  committed, ignored) — a private git-ignored `.env` is normal, a tracked key is a risk. Dante shows file, line and kind,
  never the value; example files and placeholder lines are skipped. `deep` / `tief` / `profundo` runs it by hand; its own
  weekly schedule entry (own yes, own removal) runs it Monday 03:30.
- **The motorway barrier.** The deep run closes the lane (`~/.dante/deep.lock`, key = process and time). The patrol and a
  second deep run that see the barrier step aside at once — nobody waits. A key from a dead process or older than 3 hours
  is ignored, so a crash never blocks the next run. Deep results go to the diary as `<target>·tief`.
- **A first buying nudge after three days.** Three days after the first meeting he looks once (public catalog, one
  `curl`, after your yes), then every 30 days of old knowledge, at most weekly.
- **Smoke test, 320 hostile lines in DE/EN/ES (written by DeepSeek, run in a sandbox with fake HOME/ssh/curl).** No crash,
  no stack trace, no file touched, no injected command run. Three real holes found and closed: `pack /dev/zero` read a
  device file for ever (now only real files under 2 MB), a host starting with `-` (`-oProxyCommand=…`) would have been
  handed to ssh as an option (now only plain hosts, and `--` before the host), and a garbled line heard as "disarm" removed
  the schedule at once (a free-word disarm now asks first).
- **Packs can ask for a newer Dante (`needs_client`).** A signed pack may name the Dante version it needs (a new kind of
  rule). An older Dante does not call it "invalid rule" but says plainly: needs Dante x.y.z, run `npx dante-watch@latest`,
  then `update` again. The pack stays out of `~/.dante/packs` until then.
- **Hugging Face analysis (a pack, Nr. 4) — models and agents on your own machine.** Three read-only looks, three new
  rule types (`model_card`, `model_files`, `agent_config`; that is why the pack asks for Dante 0.1.3 via `needs_client`):
  *where a model comes from* (README front matter and `config.json`: license and its class, base model, task, library, own
  code, gated), *what loading it does* (pickle formats `.bin/.pt/.pth/.ckpt/.pkl` run code on load, safetensors/GGUF do not;
  patterns for the Python files a model ships with, e.g. `os.system`, sockets, decoded payloads), and *what an agent may do*
  (MCP and agent configuration: servers that start a shell, unpinned `npx -y`, keys written into the file, plain `http`,
  broad filesystem roots — with each server's capabilities). Dante reads names, sizes, card fields and JSON keys; never the
  weights, never a secret value. The libraries were written by DeepSeek in the kitchen and checked: facts (formats, licenses,
  config locations) only where two providers agree, patterns must match their own samples under both engines, noisy checks
  are dropped against well-kept cards and harmless servers, then measured on a fixed stand (12/12 planted code tricks with 0/12
  false alarms, 10/10 risky agent entries with 0/4, 8/8 risky cards with 0/3). Ask in free words ("prüf meine modelle",
  "was darf mein agent") or type `modelle` / `models` / `modelos`; without the pack he says what it is and offers the shop page.
- **"Check my mac" / "check my server" are answered from what he knows.** "Überprüfe meinen Mac" checks this machine.
  "Prüfe meinen Server" without an address shows this machine, the servers from `user.md` and — if there are none — the hosts
  of `known_hosts`, to pick by number or by a part of a name ("alle" runs them all, a few at a time, one short line each).
  A placeholder like `server ziel` is no longer taken as a host.
- **"Do you know my servers?" / "is this server ok?"** Both are answered from what Dante knows instead of a guess. The first
  lists the servers from `user.md` (or, with none, the host names in `known_hosts`) with system and PHP where known, and offers to
  knock at the ones he has not looked at (read-only, after a yes). The second ("dieser Server gesund?", "is my mac safe",
  "¿está bien este servidor?") checks the current target. A new language-library intent covers free phrasings
  (7/10 unseen lines recognised, 0/9 false positives). Language detection of a line now understands accents and has more
  telling words per language, so a Spanish question gets a Spanish answer.
- **"Find my servers" and "how are my servers?"** Two more actions, in free words in DE/EN/ES: the first reads the places servers
  leave traces (`~/.ssh/config`, `known_hosts`), adds new ones to `user.md` with the patrol off and offers to knock at them
  (read-only, after a yes); the second looks at every known server a few at a time and reports one short line each. The language
  library learned both from about 2,200 generated variants (filtered for plausibility); on unseen phrasings 7/10 and 10/10 are
  recognised, with 0/11 false positives. The terminal tab is now titled "Dante" instead of "node".
- **Fixed:** a server line in `user.md` whose system text contained " · " (such as "Ubuntu 26.04 · PHP 8.3") lost its text and its
  patrol flag when read back.
- **Finding servers in the shell history (with a yes).** The first test on a real machine showed the weakness: there was no
  `~/.ssh/config`, `known_hosts` was cut off after 10 names in file order (the two servers actually in use fell out, github.com was
  in), and the servers the person logs in to every day were only in the shell history. Now `known_hosts` is complete without code
  hosting, and "find my servers" offers to read the history: only `ssh`/`scp`/`rsync` targets, most used first, with the key file
  name, entered in `user.md` after a second yes with the patrol off.
- **System information and "what is going on", for every target.** Two more kinds of question, answered in DE/EN/ES for this machine,
  a chosen server or all servers: "what is my system / which is my mac / how much RAM" and "what is going on / why is it slow / who is
  logged in / which ports are open". Level 1 recognises the system by rotating through a **system library** (about 85 systems, built
  by two model providers that cross-check each other, then run in rotation over all samples so no entry steals another's; five core
  entries set by hand) from a fixed list of read-only probes; level 2 reads version, hardware, memory, disk and uptime and, for "what is
  going on", load, busiest processes, open ports, failed services and logged-in users. An unrecognised system is reported as such with
  what it printed. The old five-line "what is my system" for Linux servers is replaced by this.
- **Library-wide tests.** 21 hand-written real probe outputs (Ubuntu, Debian, Alpine, Rocky, Alma, Fedora, Arch, openSUSE, Amazon
  Linux, RHEL, macOS, FreeBSD, OpenBSD, OpenWrt, Proxmox, Synology, Raspberry Pi OS, ESXi, Kali, Mint, OPNsense) must be named
  correctly (at least 80 %), a made-up system must come out unknown, and every probe must be read-only.
- **Follow-ups and a clean split of questions.** "Welche Server habe ich?" is a question for the list of servers, not for the system
  of the machine he runs on; "welcher Server ist das?" asks for the system. He also remembers what his last answer was about, so
  "welche noch?", "und die anderen?", "which others?" continue the list (all known hosts instead of the first eight).
- **The big language run for servers and systems, per language.** The language library learned the server and system questions in
  three separate runs, one per language (German, English, Spanish), 6,000 simulated people each with the Zentrale checking every
  addition: hit rate before learning 94.6 % / 95.5 % / 91.6 %, flat from 3,000 requests on (saturated), about 4,600 new checked lines.
  New intent "tell me about my systems" (this machine and every server at once). On 47 unseen phrasings 39 are recognised (DE 15/17,
  EN 12/15, ES 12/15) with 0/11 false positives; the plain forms are also caught by their words.
- **Fixed, found by checking Dante against the real servers:** a server he could not reach showed the raw `@@@@` banner of ssh; he now
  says why in words (and warns clearly when the host key has changed). The knock question explained the look-around instead of the
  knock. The welcome report printed an empty "Ich habe: ." for the newer kinds of action. Backups of public pages (`index.html.bak`)
  are a note, no longer a "secret".
- **"Is someone in between?" for a changed SSH host key (with a yes).** Instead of the raw `@@@@` banner, Dante says that the host key
  changed and offers to look: the public keys the server shows now (no login), the ones in `known_hosts`, and the same keys seen from
  one or two of your other servers. Same new key everywhere and all key types new = fits a rebuilt server; different keys from different
  places, or only part of the keys changed = attention. The report ends with the fingerprint to compare in the provider's console,
  because that is the only proof. A knowledge card (DE/EN/ES) explains the topic; free questions ("ist jemand dazwischen",
  "man in the middle", "la clave ha cambiado") start the check.
- **The lab (test builds only).** 111 first-time sessions played by DeepSeek (23 roles x 3 languages, 1M tokens) against a real Dante, with
  a Zentrale sorting what he did not understand (another 1M tokens). Result before the fixes: rating 1.9 / 5, only 34 of 111 sessions got
  a real answer, 56 were asked to arm 3 times or more. Fixes: the first meeting asks ONE question (the chain of five is gone: arming,
  knocking and the deep run stay one word away), a yes with more words counts for read-only questions, a no with more words is a no,
  a line that answers nothing is a new request and is handled as such, "what?" is explained once and then answered short, the
  language of a line no longer flips on the German word "es", and "ich heiße …" sets the name. Replayed lines of 30 sessions against the
  fixed build: arming asked 3+ times in 0 of 30 (before: 17 of 30), repeated replies 2 (before: 62). The Zentrale's sorting and
  readings of answers (about 450 lines) went into the language library. The call home lives in `src/lab/` and is not in the package.
- **"Update?" instead of a command to copy.** The footer no longer says "Get the latest: npx dante-watch@latest" but "Update? Say update, and I
  check whether there is something newer" (and the line for old knowledge says the same). `update` now also asks the public npm registry
  for the newest version (one curl, shown first, run after a yes, nothing of yours goes out) and tells whether a newer one exists and how
  to start it; `version` shows the running version. Free phrasings ("gibt es ein update", "am I up to date", "hay una versión nueva") work too.
- **Many machines.** The patrol and the deep run work through the servers a few at a time (at most 6, `DANTE_PARALLEL`), so
  one dead host holds one slot instead of the whole run.
- **A wrong tip is gone:** "Dante sends nothing. No network …" is now "Dante never calls anyone on his own.
  Only `update`, after your yes, fetches packs."
- Plain output without a terminal (pipes, cron, tests) is unchanged: no footer, no bar.

## 0.1.1 (unreleased)

- **Dante hears what you mean:** a local router (`src/bib/router.mjs`) turns a typed line into an
  intent + probability: first word, words, word pairs and letter triples, weighed by how many
  intents share them. Typos land ("prüff", "servr"). Below 60 % he asks back ("Meinst du raus?")
  and a plain "ja" takes the guess; outside his work he says so instead of acting.
  Measured: held-out 40 lines → 35 right · 4 asked · 1 wrong.
- **Session talks:** "kannst du meinen server checken" asks for the target; `server`, `key`, `prüf`,
  `fix`, `demo`, `karte`, `raus` still work as single words.
- **Loading-screen line under the input bar:** turning wheel, tips typing themselves in, and the
  inner clock (`bib 25.10. · 0d`). Past 14 days it says the knowledge is old and names
  `npx dante-watch@latest`. One-shot runs print the same line. Local arithmetic — no update check.
- **Washer** (`src/bib/wash.mjs`): personal values → global slots ({IP}, {ZIEL}, {MAIL}, {URL},
  {PFAD}, {KEY}, {TEL}, {NUM}, {NAME}); the sentence stays 1:1. 46 cases.
- **The bib (first kitchen run):** DeepSeek played users — admin, beginner, fast typist with typos,
  scared after a hack, Dominican teacher, Latin-American shop owner, terse dev — in four categories
  (commands · fix talk · questions · not-Dante's-work), seeded by washed real goals. 6,204 lines for
  the ear, 2,474 for the yes/no moment, shipped as readable JSON. Real goals are not in the package;
  generated lines too close to one were dropped (19).
- **Complement naive Bayes:** big intents no longer swallow small ones. Measured on hand-written
  and real unseen lines (108): 96 right · 8 asked · 4 wrong (before the bib: 10 wrong on 48).
- **Dante answers questions** (what is the hole, what does UNBEKANNT mean, am I hacked, who are
  you) in German or Spanish, max five lines, never claiming a result.
- **The yes/no moment listens:** only a clean "ja" is a yes ("ja aber erst morgen", "jein", "ja?"
  were yes before — now they change nothing). "was macht das?" shows the exact commands, "geht da
  was kaputt?" says what changes, "später" leaves everything as it is.
- **Fix:** the yes/no question opened a second reader on stdin — every key doubled and the session
  went deaf afterwards. It now borrows the session's reader.
- **Kitchen run in stages (DE/EN/ES equal):** ~50k → 100k → 300k → 500k output tokens per category.
  Ear on 138 unseen lines: 117 → 128 → 129 → 130 right, wrong 4 → 2. Ships 53,002 ear lines +
  18,898 yes/no lines (package 979 kB packed). Classes balanced; a feature counts fully only after
  5 sightings. Dante now speaks German, English and Spanish everywhere, verdicts included.
- **The bib grows only at gaps (kitchen loop):** DeepSeek plays a person, Dante hears first; only
  a miss goes to the Zentrale, which checks the label and fills E1 (general) → E2 (the person's
  way) → E3 (the line itself, washed), re-checking after each. Guards: no (near-)repeats, nothing
  too broad (anchors). 16,888 + 8,769 simulated requests; +11,483 lines. Sorted bib:
  category → intent → [line, level, language] — 83,383 lines.
- **Three neurons, local in every install:** counting ear (Bayes) + a small net (fastText-style,
  int8 weights as plain numbers) + a combiner. Command ear acts only when both ears agree; the
  yes/no ear uses the combiner (it can never say yes). Exact memory: a line standing 1:1 in the
  bib is known without a probability.
- **Big test (fresh stream, 1,771 new lines):** wrong 8.9 % (Bayes alone) → 3.8 % (both agree).
  Hand-checked all 67 remaining: 51 Dante was right (simulator label wrong), 13 ambiguous,
  3 really wrong (0.2 %).
- **Second simulator (gpt-5.4-nano, other handwriting):** fresh nano stream first, nothing learned
  — command ear held (4.2 % wrong vs 3.8 % on DeepSeek), yes/no ear dropped to 10.8 % wrong. Then the
  loop learned from nano (4,281 + 2,335 requests; the "too broad" guard fired 253× — never with
  DeepSeek). After: nano stream ear 77.4 → 79.9 % right, 4.2 → 3.3 % wrong; yes/no 89.6 → 93.2 %,
  5.3 → 2.7 % wrong. DeepSeek stream and hand set did not get worse.
- **Yes/no moment:** a long yes ("ja ohne wenn und aber", "Sí. apt upgrade …") is asked back
  ("type just yes") instead of read as no; "what does it do" and "is it dangerous" both get the
  steps AND what changes (they overlapped).
- **The big run (staged, checked at every checkpoint):** DeepSeek, ear to 100,000 simulated
  requests, yes/no to 100,000. Loop hit rate ear 83.9 → 79.6 → 82.5 % (windows to 1k / 10k / 100k),
  yes/no flat 94 %. On the fixed tests the extra 90,000 lines from 10k → 100k moved nothing (±1 pt)
  — the language bib is saturated; the run was closed at 100k instead of 300k. Shipped: the 10k
  state (same accuracy, starts in 1.7 s instead of 3.0 s, 2.6 MB instead of 3.7 MB); the full harvest
  is kept in bib/loop/big/full. Small talk grew from 132 to 8,869 lines.
- **Risk-weighted threshold:** answers (questions, small talk, greeting, help) may speak from 40 %,
  actions still need 60 % — wrong ACTIONS measured unchanged, fewer ask-backs.
- **Shipped language bib, measured:** hand set 134/152, 2 wrong; fresh DeepSeek stream ear 82.5 %
  right (wrong action 1.0 %), fresh nano stream 80.3 % (wrong action 0.3 %); yes/no 33/33 on the hand
  set, never a wrong action.
- **Small talk — a fifth category and a new intent:** chatting with Dante (how are you, a joke,
  thanks, a long shift) gets a short in-character answer in DE/EN/ES and steers back to work.
  Seeded by gpt-4o-mini playing people like the maker (a chef turned founder: fast, lowercase,
  typos, kitchen slang), then grown by the DeepSeek loop.
- **Clean labels:** the Zentrale re-read all 22,284 "not Dante's work" lines and moved 1,573 that
  were really Dante's (378 "am I hacked", 223 questions about the hole, 210 server checks …, 132 small
  talk).
- **Loop guards fixed by measurement:** a flip greeting ↔ small talk (or "what does it do" ↔ "is it
  dangerous") is no harm — without that the guard threw out small talk 771×. The self-stop compares
  only windows of ≥ 1,000 lines and only on a drop beyond max(5 points, 3 × standard error).
- **"lokal" is a slot, not an intent** (it overlapped "check": "check local" is both).
- **Hard bolt:** a request to attack (any language) never reaches a check; a defender's question
  ("could someone attack my server") passes.
- **System knowledge — a sixth bib and a third ear (`src/bib/system.mjs`):** kept apart from the
  five language bibs on purpose. When the main ear has a gap, Dante opens the technical book and the
  third ear picks the move: `fingerabdruck` (which system am I on), `finde_php`, `pruef_php2shell`,
  `beleg` (show the real line), `fix_php2shell`. The system family (debian / alpine / fedora / arch)
  is a SLOT, read off the target itself — Dante does not trust what the user says the system is — not
  an E1/E2/E3 depth (nothing personal to anonymise). The bib carries only which move; the hit-logic
  stays deterministic code, and the truth is still the real line read at runtime.
- **Filled by the same kitchen loop, staged and checked:** DeepSeek typed system situations in
  DE/EN/ES, the main ear heard first, a gap went to the Zentrale. Window hit rate 80.7 → 86.2 → 87.7
  → 88.0 % (to 5k/10k/15k/20k) — saturated, closed at 20k; a gpt-5.4-nano pass mixed in a second
  hand (its lines were 84.7 % already understood, +171 added). 12,646 lines across the five moves,
  no "too broad" flip. Ears: all six system moves routed 99–100 %, no language intent hijacked.
- **Live test on an own server:** channel proven by nonce; fingerprint read `ubuntu 26.04` off the
  box itself (family debian); a planted old `PHP 8.2.3` found by its real line; verdict UNKNOWN —
  PHP present but patch state not provable, so neither a false "safe" nor a false "risk".
- **Family-driven fix:** the php2shell fix now speaks the target's own package manager — debian
  (`apt-get` + `systemctl`), alpine (`apk` + `rc-service`), fedora (`dnf`), arch (`pacman`). The
  family is read off `/etc/os-release` on the target, not from what the user says; unreadable →
  debian. Proven live: a planted unpatched PHP + a readable CVE-less changelog → WARN with the
  debian `php8.2-*` steps built from the detected family.
- **"Show me the line":** "zeig mir die zeile die das beweist" after a check now prints the real
  last evidence line (the `beleg` move) instead of explaining what a Beleg is — the main ear hears
  it as frage_urteil, the system ear as beleg, so beleg wins only when a result already stands.
- **The Muster-Bib — the watchman's base knowledge of what is WRONG (a fourth ear `muster`):** five
  moves beyond php2shell — `patrouille` (the whole round), `webshell`, `secrets`, `sshd`, `rechte`.
  Sits behind the main ear's gap, asked BEFORE the system ear (it only fires on its five worries and
  says unknown on every real php2shell line, so the greedy pruef_php2shell cannot steal "prüf alles"
  or "ist meine .env offen"). DeepSeek grew it: window hit rate 85.1 → 93.5 → 93.6 → 94.9 % (to
  2k/5k/10k/15k), saturated, 5,110 lines; ears 10/10 on held-out moves, no language/system intent
  hijacked.
- **A watchman battery (`src/checks/`), each check read-only and honest:** `secrets` (world-readable
  .env/.sql/.git in a web root → RISK), `webshell` (PHP with backdoor markers → WARN, path only,
  never the file's contents), `sshd` (root + password login via effective `sshd -T` → WARN), `rechte`
  (world-writable files in /etc and web roots → WARN). No standard web root → UNKNOWN, never "safe".
  Shell traps fixed by measurement: a loop's exit code is unreliable (trust the printed lines, not
  `$?`); a `$` in a grep pattern must be single-quoted or the remote shell eats it.
- **Live test on an own server:** "prüf alles" ran the whole round and caught a planted exposed
  `.env` (RISK) and a planted webshell marker (WARN) by their real paths, SAFE elsewhere with real
  lines; single worries routed to single checks; a real php2shell question still went to the system
  ear. Server restored.
- **Packs — fresh rules, one by one (`src/pack/`):** a pack is a data file with new rules and the
  explanations that go with them. No subscription: a pack is bought once and is yours, packs live side
  by side as `~/.dante/packs/pack-<n>.json` and nothing is ever replaced or deleted. The newest pack costs
  4 €, every older one is 80 % cheaper, one pack is free (just an email). Dante accepts a pack only if size,
  JSON, an Ed25519 signature (public half in the package, private half only in the kitchen), an expiry date
  and a fixed schema all hold; otherwise he ignores it and says why, in the person's language. A pack is
  data, never code: four rule types (`version_cve`, `path_exposed`, `file_pattern`, `sshd_setting`), an unknown
  type is refused, every command Dante runs stays in his own source. A rule can only add warnings; "safe"
  still needs a real line.
- **Getting packs — the only call, and you start it:** `update` (`aktualisier`, `actualiza`) prints the exact
  `curl`, asks yes/no, and on a yes fetches ALL your packs in one call to `…/dante/packs`, carrying only your
  token (passed on stdin, never in the argument list). The curl runs on your machine, never on the server you
  check. `pack <file or folder>` installs downloaded packs without any network. Paste a token anywhere in a
  line and Dante recognises it by its shape and offers to save it (mode 0600). After an update a visible
  UPDATED block names the packs, the new and changed rules and what was there before. The loading-screen
  clock counts from the newest pack and tips point to `npx dante-watch@latest` and to packs.
- **The shop (`server/`, not in the npm package):** its own small service on the cash-desk server, behind
  `/dante` on api.nm-streetwear.space — a page in German/English, the free pack, SumUp checkout (the server
  asks SumUp itself and never believes the page), the catalog, the bundle download, lost-token replacement.
  The database holds only the hash of a token. The cash desk holds no signing key.
- **The checks are built from rules:** PHP2Shell, secrets, webshell and SSH read their data from rules; the
  built-in rules are the free state. **Behaviour change:** `npx dante-watch` and `prüf` now run the whole
  battery, not only PHP2Shell, so the exit code 2 now also stands for an open secret or a found webshell
  marker (and `server <host>` shows all five checks). Asking about PHP2Shell only still runs only that one.
- **Everything Dante says speaks German, English and Spanish.** About 60 sentences of the new checks were
  German-only and are now in the phrasebook; every rule and every pack carries its texts in all three
  languages and the pack factory refuses to sign a rule without them; reasons a pack is refused come as codes
  and are put into words in the person's language; the "unknown" badge no longer is hard-coded German.
- **Dante explains his job (knowledge cards + a fifth ear):** for every topic he watches there is a card in
  three languages — what it is, why it is dangerous, what stands out, what is normal, how he looks, what to do.
  Cards travel in packs, and the factory refuses a rule without a card, so Dante watches nothing he cannot
  explain. Ask *what do you watch?*, *what is a webshell?*, *what stands out?*, *is that normal?* (after a
  finding he explains that finding), *how do you check SSH?*, *what do I do about it?*; the topic is found by
  the card's keywords, the way of asking by the new Fachwissen ear (kitchen loop 76 → 86 → 89 %, saturated).
  Answers are four lines at most and state knowledge, never a result.
- **"What is my system?"** now answers in five lines from what the target prints (system, kernel, arch,
  package manager Dante would use for fixes, PHP, web server, what he checks there) instead of one line; the
  German phrasings were the thin spot and were trained again (routing 15/24 → 23/24 on held-out lines).
- **The domain ears know what is not theirs:** the patrol (muster), system and explain ears each learn the
  other domains' lines and a fixed sample of everyday lines ("not Dante's work", small talk) as "not mine". On
  88 held-out lines in three languages 87 land right, and all 24 off-topic lines stay out ("what is the
  weather", "write my essay" no longer start a scan). The main ear is unchanged: hand set 134/152 (2 wrong),
  yes/no 33/33.
- **Found by testing and fixed:** a refused pack crashed the start; an installed pack was written without
  its signature and would have been refused at the next start; a regex swallowed German raw lines; a shell
  `$` in a pattern was expanded by the remote shell; an exit code of a loop was trusted over its output.
- **README told the truth about the network:** it now says exactly what can leave the machine (one `curl`, only
  after "update" and a yes, only the token), what Dante reads and writes (`~/.dante/`) and which Node modules
  it uses.
- Still zero dependencies, no network code, no install scripts. Tests are not shipped.

## 0.1.0 (2026-10-24) — first release

- **Check:** PHP2Shell (CVE-2026-109618 / -109619) on a server you own. Reads version, distro
  changelog, service state and web exposure; every verdict carries the real command and its line.
- **Never lies to itself:** proves the channel first (nonce must return, else UNKNOWN); a version
  number alone never decides (distro backports); unreadable proof → UNKNOWN, never "safe".
- **Human, listen — plan — ja/nein (`--fix`):** on a finding Dante comes to the foreground, shows
  its plan in words and the exact commands, asks yes/no, acts only on yes, then re-proves the fix
  with a fresh real line. Trust count per check earns an automode offer after 5 yeses.
- **`--demo`:** a harmless practice "open door" (a temp file) to watch the whole loop safely.
- **Zero dependencies, no network, no install scripts.** Nothing is sent anywhere.
