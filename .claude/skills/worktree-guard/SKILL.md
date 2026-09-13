---
name: worktree-guard
description: Run at the start of ANY task in this repo that will change files, before the first edit. Proves the current worktree is the canonical one and that the running dev server serves it. Never creates, removes, or switches a worktree — it only checks and reports.
---

# Worktree Guard

This project works from ONE canonical worktree, but many other worktrees exist
on this machine (nested under `.claude/worktrees/`, in `C:/tmp`, and elsewhere).
This skill is the INVERSE of a "create an isolated worktree" skill: its only
job is to confirm you are already in the right place before any file is
touched.

## Iron Rule

No file is edited until:
1. The current worktree is confirmed canonical, AND
2. The running dev server is confirmed to serve that same worktree.

This skill never creates, removes, switches, prunes, or forces anything. It
reports and stops. It is read-only.

## Detection Steps

Run every step below and show the real output in the report. Do not
paraphrase or assume a result.

### 1. Identity
```
git rev-parse --show-toplevel
git rev-parse --git-dir
git rev-parse --git-common-dir
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
```
`--show-toplevel` is the current worktree's root. `--abbrev-ref HEAD` and the
SHA are the branch and commit you are actually standing on.

### 2. Linked-worktree check
Compare the `--git-dir` and `--git-common-dir` values from step 1.
- **Equal** (both `.git`) → you are in the main checkout.
- **Different** (`--git-dir` is a path under `.git/worktrees/<name>`) → you
  are in a LINKED worktree, not the main checkout.

Before treating a "different" result as a linked worktree, rule out a
submodule false positive:
```
git rev-parse --show-superproject-working-tree
```
Non-empty output means the current directory is a submodule inside another
repo, not a git worktree — a different situation that this skill does not
attempt to resolve; report it and stop.

### 3. Enumerate every worktree
```
git worktree list
```
Report each line: path, checked-out branch (or `detached HEAD`). This is the
full population you are choosing among, including stale ones nested inside
`.claude/worktrees/` or sitting in `C:/tmp` / `%TEMP%`.

### 4. Canonical source of truth
Read the project's `CLAUDE.md` (the one in this project folder, not the
workspace-root or user-global one) and look for a stated canonical worktree
path and canonical dev URL/port.

Do not hardcode a path or port this skill cannot verify from that file. If
`CLAUDE.md` states a port (for example, as part of an allowed-origins or
timeout setting) but never explicitly labels a worktree path as canonical,
report exactly that: "port `<N>` is referenced, but no worktree path is
labeled canonical" — do not upgrade an inferred value into a confirmed fact.
If `CLAUDE.md` states neither, report the gap explicitly and ask the human
which worktree/port is canonical rather than guessing.

### 5. Running servers (Windows)
The canonical dev URL from step 4 uses port 5184 (per CLAUDE.md's
`AUTHORIZED_TRANSCRIPT_LOCAL_STORAGE_ORIGINS` entry). Vite auto-increments
past a taken port, so the dev-server range for this project is **5180–5199**
— wide enough to catch realistic auto-increment drift, narrow enough to
exclude unrelated system/tool ports (RPC, SMB, WSL relays, background CLIs)
that a plain `netstat -ano | findstr LISTENING` also returns as noise. List
only that range, then resolve each PID to the command line it was launched
with (which reveals the directory it was launched from):
```
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -ge 5180 -and $_.LocalPort -le 5199 } | Select-Object LocalAddress, LocalPort, OwningProcess
```
For each PID of interest:
```
Get-CimInstance Win32_Process -Filter "ProcessId=<PID>" | Select-Object ProcessId, ParentProcessId, Name, CommandLine
```
The `CommandLine` field shows the full path to `vite.js` (or equivalent) as
it was invoked — that path tells you which worktree launched that server.
A path containing `.claude\worktrees\<name>` or a `C:\tmp\...` location means
that server was launched from a non-canonical worktree, even if its port
looks unremarkable.

A LISTENING process on the right port is not proof it is the one actually
being viewed: two processes can bind the same port number on different
address families (IPv4 `127.0.0.1` vs IPv6 `[::1]`). If more than one PID
listens on the canonical port, also check `ESTABLISHED` rows on that port:
```
Get-NetTCPConnection -State Established | Where-Object { $_.LocalPort -ge 5180 -and $_.LocalPort -le 5199 } | Select-Object LocalAddress, LocalPort, RemotePort, OwningProcess
```
and match their PID against the one whose `CommandLine` you resolved above —
do not assume the first LISTENING match is the live one.

More than one `ESTABLISHED` row on the same server (distinct `RemotePort`
values, same `OwningProcess`) means more than one browser tab or window is
currently open against that server — each `RemotePort` is a separate client
connection. This matters because it raises the exact risk this skill exists
to prevent: a human can have a non-canonical worktree's server open in one
tab and the canonical one in another, glance at the wrong tab, and approve
an edit while actually looking at stale or unrelated content. Any
`ESTABLISHED` row at all on a **non-canonical** server (one whose
`CommandLine` directory, per step 6, is not the canonical worktree) means
someone is actively viewing it right now — see Stop Conditions.

### 6. Match
For every running dev server found in step 5, state in the report which
worktree (from step 3) launched it, by matching the `CommandLine` directory
against each worktree path. Explicitly name which server, if any, is the one
serving the canonical URL from step 4.

## Stop Conditions

Report and halt — do not proceed to any edit — when any of these hold:
- The current worktree (step 1) is not the canonical one (step 4).
- More than one dev server is running (step 5) and it is not clear from the
  task or the human which one is being looked at in the browser.
- The server bound to the canonical port was launched (per its `CommandLine`)
  from a different worktree than the one currently open for editing.
- The branch checked out (step 1) is not the branch the task says it expects.
- `git worktree list` (step 3) shows a worktree nested under
  `.claude/worktrees/` (or another obviously stale/scratch location) whose
  dev server is also currently running.
- Any non-canonical dev server has a live `ESTABLISHED` client connection
  (step 5) — someone is actively looking at a non-canonical worktree right
  now. This is a stop even if the canonical server is also running fine.

When halted, list explicitly what the human must decide: which worktree is
canonical, which server to keep looking at, or which one to shut down
manually.

## Report Shape (produce this before any work begins)

- Canonical worktree path and canonical URL, and exactly where each was
  read from (or "not stated in CLAUDE.md" if applicable).
- Current worktree path, branch, HEAD SHA.
- Table of every worktree from `git worktree list`: path | branch | server
  running from it? | port.
- Verdict: **SAFE TO EDIT** — or — **STOP: <specific mismatch>**.

Every line of the verdict must be traceable to command output shown in the
same report. No line may be asserted from memory or assumption.

## Hard Stops

Never, under any circumstance, as part of this skill:
- Run `git worktree add`, `git worktree remove`, `git worktree prune`, or any
  `--force` flag.
- Run `git reset`, `git clean`, `git checkout --force`, or delete files.
- Kill, stop, or restart a dev server process.
- Commit, push, merge, or switch branch or worktree.
- Conclude **SAFE TO EDIT** without every supporting line coming from actual
  command output shown in this run's report.

## Common Rationalizations

| Tempting thought | Reality |
|---|---|
| "I'm obviously in the right folder" | `pwd`/the editor's open folder can differ from where a background dev server was actually launched. Only `git worktree list` + the server's `CommandLine` prove it. |
| "Only one server is running" | A single listening port does not mean a single server — Vite auto-increments ports, so a second instance can be running quietly on 5190, 5191, etc. Check the full listening-port range, not just the expected one. |
| "The port is right so the folder must be right" | A server can be started with `--port <canonical>` from inside any worktree. The port matching proves nothing about which directory launched it — only the `CommandLine` path does. |
| "The other worktree is stale, I'll clean it up" | Cleanup is out of scope for this skill. Removing or pruning a worktree is a destructive action requiring explicit human approval, never a side effect of a guard check. |
| "I'll just check after I make the edit" | The whole point is to prevent editing the wrong checkout. A check performed after the edit cannot undo writing to the wrong worktree. |
