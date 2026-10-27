# Dante

**Dante watches a server you own — and never lies to itself.**

```
npx dante-watch                 # open a session: talk to Dante in German, English or Spanish
npm i -g dante-watch && dante   # install once, then summon him with one word (careful: `npx dante` is another package)
npx dante-watch --version       # which version runs
npx dante-watch --ssh root@host --key ~/.ssh/id   # check a server you own, once
```

Every verdict carries the real line it came from. If Dante cannot read the proof, it says
`unknown` — never `safe`. Safe is a thing it proves, not a thing it assumes.

## What Dante sends, reads and writes

**By default and on its own: nothing.** The code has no `fetch`, no HTTP client, no telemetry, no background update check.
While you talk to him, and while he patrols, he calls nobody.

Exactly three things can use the network, and **you** start each, after a clear *yes* to the command he prints (the third goes to the public npm registry, not to us):

- `update` (German `aktualisier`, Spanish `actualiza`): one `curl` to `https://api.nm-streetwear.space/dante/packs`
  carrying **your license token** and nothing else. `update` also looks around again on your machine (see below).
- `update`/`version` also asks the **public npm registry** whether a newer Dante exists: one `curl` to `https://registry.npmjs.org/dante-watch/latest`, nothing of yours goes out.
- `buy` (`kaufen`, `comprar`), or a question once a week when his knowledge is 30 days old: one `curl` to the
  **public** catalog `https://api.nm-streetwear.space/dante/catalog`. Nothing of yours goes out, not even a token.
  Only if there are packs you lack does he ask whether to open the shop page in your browser.

You can skip both forever. The free state is complete and runs offline. Download a pack in a browser and install it
with `pack <file>`, and Dante never touches the network at all.

**Getting to know you (`user.md`).** On the first start he asks *"May I look around?"*. On a *yes* he reads, on this
machine only: the system name, your Git name, the hosts in `~/.ssh/config` and the readable ones in
`~/.ssh/known_hosts`, and the **names** of your project folders (folders with a `.git`). He does not read file
contents and not your shell history. He writes it into `~/.dante/user.md` — plain Markdown you can open and change.
Every 20 days he asks whether to look again; `update` does it too. He knocks at a server over SSH only if you said yes
to that server, read-only, with your own key.

**The schedule (armed).** Only after a separate, clear *yes* he writes a schedule — a launchd agent on a Mac, a cron
entry elsewhere — that starts `dante-watch --patrol` four times a day (00, 06, 12, 18 h). A patrol runs the checks on
this machine and on the servers you approved, writes `~/.dante/diary.jsonl` and changes nothing; its only connections are
SSH to those servers. You can ask him *"what happened?"* and he answers from the diary. `abschalten` / `disarm` /
`desarmar` removes both schedules again; it is shown in plain words before it is written.

**The deep run (`deep`, weekly if you said yes).** This is the one place where Dante **reads the content of your files**
— locally, read-only: he searches your project folders (and the web roots of servers you approved) for keys, tokens
and passwords left in code, with the formats of his check library (hundreds of patterns for AWS, GitHub, Stripe, private
keys, database URLs, … built per system: he first looks which systems are there — `package.json`, `composer.json`,
`requirements.txt` … — and uses only those patterns). On a hit he looks closer: file rights, is it in Git, was it ever
committed, is it git-ignored. **He shows the file, the line and the kind of secret — never the value.** A key in a private,
git-ignored file (your local `.env`) is normal and says so. Example files (`*.example`) and placeholder lines are skipped.
He skips `node_modules`, `.git`, `vendor` and build folders. Nothing leaves your machine. It has its own schedule entry
(Monday, 03:30) with its own yes, and while it runs it closes the lane: the patrol sees the lock and steps aside instead
of waiting. A lock left behind by a crash is ignored after a few hours.

**Models and agents (the pack "Hugging Face Analysis", `models`).** With this pack Dante looks at the AI models you downloaded
(the Hugging Face cache `~/.cache/huggingface/hub`, `~/models`, your project folders) and at the configuration of your AI
agents (for example `~/.claude.json`, Claude Desktop, Cursor, `.mcp.json`). For a model he reads names, sizes, the head of the
README (the model card) and `config.json` — **never the weights**; for the Python files a model ships he reports the file, the
line and the kind of pattern, not the code. For an agent configuration he reads the JSON locally and reports server, what it
can do and what stands out — **never the values**, so no key or token is shown. Nothing leaves your machine. Without the pack
he says what it is and offers to open the shop page.

**Finding your servers (`find my servers`).** Dante reads `~/.ssh/config` and the readable host names in `~/.ssh/known_hosts`
(code hosting such as github.com is left out). Only after a separate *yes* he also looks into your shell history, and there
only at lines that start `ssh`, `scp` or `rsync`: he keeps who@where, how often, and the name of the key file, nothing else
from the history. Servers found this way are entered in `user.md` with the patrol off; knocking at them (to read the system and
PHP version) is another *yes*.

**What system is this, and what is going on there?** (`what is my system`, `which is my mac`, `what is going on`, in German, English
and Spanish). For this machine, a server you picked or all known servers, Dante runs a fixed list of harmless read-only probes
(`/etc/os-release`, `uname`, `sw_vers`, `freebsd-version`, `hostname`, `df`, `uptime` and the like; the list is in `src/me/sysid.mjs`)
and recognises the system from their output against a library of about 85 systems (Linux distributions, macOS, the BSDs, OpenWrt,
OPNsense, Proxmox, ESXi, Synology and more). The library holds only patterns and facts, never a command of its own, and a system it
does not recognise is called unknown, not guessed. "What is going on" adds the busiest processes, open ports, failed services and who
is logged in. Everything shown is read off the machine; the "usual for this system" line (package manager, firewall, logs) comes from
the library and is labelled that way.

**"Is someone in between?" (a changed SSH host key).** When a server's key has changed, Dante offers a look, without logging in:
he reads the public keys the server shows (`ssh-keyscan`), compares them with the ones remembered in your `known_hosts`
(`ssh-keygen -F`), and, after a separate *yes*, also runs `ssh-keyscan` from one or two of your other servers over ssh. A rebuilt
server shows the same new key from everywhere; an attacker on your own path shows your machine a different key than a server elsewhere
sees. He reports what speaks for or against and never calls it safe: only a comparison with the provider's console proves the key
is the server's own, and he prints the fingerprint to compare. Nothing is changed and nothing is sent anywhere.

What he reads and writes on your machine: the folder `~/.dante/` — your token (mode 0600), the packs you installed,
`user.md`, the diary, the small scripts the schedules start (`patrol.sh`, `deep.sh`), a lock file while the deep run is on, a note of when he last asked — plus the schedule entry if you
armed him. Fixes happen only after a clear *yes*, with the exact commands shown first.

- **No install hooks.** `npm install` runs no scripts. No `postinstall`, nothing executes on install.
- **No dependencies.** Only Node (≥18) and its own modules (`child_process`, `fs`, `os`, `path`, `readline`, `crypto`,
  `worker_threads`, `url`, `net`, `os`). Nothing is pulled in that you did not read.
- **The code is readable.** The rest of the package is data: the language books and rules as plain JSON
  (`src/bib/*.json`), no blobs, no obfuscation.

If you review packages for a living: this one does not phone home, and it says so here on purpose.
Questions: info@nm-streetwear.space.

## Packs: fresh rules, one by one

Dante ships with the rules of the day it was published. New holes appear every week, so we publish
**packs** — sets of new rules, each with its explanations in German, English and Spanish.

- No subscription. A pack is bought once and is yours; old packs keep working next to new ones.
- The newest pack costs 4 €, every older one is 80 % cheaper. One pack is free, with just an email.
- A pack is **data, never code**. It is signed (Ed25519); Dante checks the signature, the size, an
  expiry date and a fixed rule schema on your machine, and runs nothing a pack carries. A pack that
  fails any check is ignored, and Dante tells you why. A rule can only add warnings in four known
  shapes — it can never make Dante say `safe` without a real line.
- Dante only checks things he can also explain: the pack factory refuses to sign a rule without its
  explanation in all three languages.

Get packs at https://api.nm-streetwear.space/dante/ .

## Ask Dante

He explains what he watches and why, in your language — *what do you watch?*, *what is a webshell?*,
*what stands out?*, *is that normal?*, *how do you check SSH?*, *what do I do about it?* — and what
system he is looking at (*what is my system?*).

## Windows (preview)

On Windows Dante recognises the system at start and says in his first lines what he can do there. He needs **no bash**: on this
machine he asks his questions in plain Node (`src/core/fsx.mjs`), and runs system programs directly, without a shell around them.
What he reads there: SSH settings, web folders (IIS, XAMPP, WAMP, Laragon), readable secrets, webshell patterns, the PHP version
(by version number: Windows PHP has no distro backports), keys in code (the deep run, with `git`), the system and its open ports,
and the Windows side of "writable by everyone" (services whose program file or folder anyone may change, unquoted service paths with a
space, writable folders in `PATH`, `AlwaysInstallElevated`, an autologon password in the registry - he says *that* it is there, never
its value). Your Linux servers he checks over `ssh.exe` as everywhere else. What he cannot read he calls *unknown*, never *safe*.
Not yet: running processes. The schedule (`scharf`) uses `schtasks` and has not run on a real Windows yet.

It is tested on macOS, Linux and a **real Windows Server runner** (GitHub Actions): the whole test suite, plus one real run of Dante that
types its answers like a person. Still missing: a run on a localized (for example German) Windows - program outputs are translated
there, and that is where the next surprise would hide. Tell us what you see.

## Why

In October 2026 the PHP2Shell flaw (CVE-2026-109618 / -109619) put most of the web on the clock,
and AI agents started hunting unpatched servers within the hour. The honest defence is not a
scary report — it is a fast, grounded check you can run on your own box and believe.

## How it stays honest

- **Channel first.** Dante proves it can see the target (it must get its own nonce back) before it
  concludes anything. No channel → everything is unknown.
- **Every claim shows its line.** A claim without a real command output is printed as a gap, never
  as proof.
- **Backports are respected.** A distro patch keeps the old version number but fixes the bug, so a
  version number alone can never decide. The changelog is the authority; if it can't be read, the
  answer is unknown.
- **Read-only by default.** Dante looks and reports. It changes nothing without your clear *yes*,
  and it shows the plan and the exact commands first.
- **Check me against another AI.** If Dante tells you something is open, verify it against an
  independent model. If that check disagrees, write us: info@nm-streetwear.space.

## How it got built (and why we tell you)

We use AI. All the way, on purpose. We have no investors and no team, and we chose to go after a field where funded companies are
already running, so the only fair fight was speed - with proof.

In about three days (first commit 25 Oct 2026):

- **7,600 lines** of Dante across 77 files, plus **2,800 lines of tests** - 289 of them, green on macOS, Linux and a real Windows Server.
- **259,000 checked sentences** in German, English and Spanish, so he understands what you type - the way a person types it.
- **1,111 secret formats** (cloud keys, tokens, private keys) he looks for in your code, and **86 systems** he can tell apart.
- One real run of Dante on a real Windows Server, with answers typed like a person, on every change.

A normal team at a normal pace needs, on our own conservative assumptions - 75 finished and tested lines per developer-day, 300 labelled
sentences per hour, half an hour per secret format - roughly **320 person-days**: a person-year and a half. In three calendar days that
is a factor of about **100**. This is our estimate; the assumptions are written down so you can change them and do the sum yourself.

What the AI does not get to decide: every claim Dante makes has to show the real line it came from, "safe" is only said with proof,
and nothing changes on your machine without your *yes*. The tests, the equality checks against the real `find`/`grep`, and an opponent
that attacks Dante with hostile input are there to catch exactly the mistakes a fast machine makes. If you find one anyway, tell us.

## Credits

Dante is the pilgrim who walked through Hell and came back with the map - companion to
[Virgil](https://www.npmjs.com/package/virgil-cli). Built by nm.

Where the knowledge comes from, and what was *not* taken:

- **What attackers look for on Windows** (which places are worth checking: services, `PATH`, scheduled tasks, autostart, registry settings)
  was learned from the public documentation and check lists of PowerSploit/PowerUp, SharpUp (GhostPack), WinPEAS and HardeningKitty,
  and from Microsoft's own documentation of `icacls`, `schtasks` and the registry. We read what they look for; **we copied no code**.
- **Technique names** in the explanation cards follow MITRE ATT&CK where we are sure of the id.
- - How the code and the library were made, and how fast: see **How it got built** above.
- Runs on [Node.js](https://nodejs.org) and your system's own `ssh`, `git` and `curl`; nothing else is installed.

MIT License
