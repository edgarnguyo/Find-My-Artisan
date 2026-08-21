# Git — why it exists, how it works, and the commands worth knowing

Notes grounded in this repo (`Find-My-Artisan`, three people working on
`main`, `person-a`, `person-b`).

---

## 1. Why git exists

Without version control, collaboration degrades into one of two failures:

- **Overwriting.** Two people edit `ListingsPage.jsx`; whoever saves last wins,
  and the other's work is gone with no record it existed.
- **Folder archaeology.** `project-final`, `project-final-v2`,
  `project-final-ACTUAL`. Nobody can say what changed between them or why.

Git solves both by storing **the full history of every change, with an author
and a reason attached**, and by being able to merge two people's edits to the
same file automatically as long as they touched different lines.

The property that matters most day to day: **committed work is very hard to
lose.** Almost every mistake is recoverable. Uncommitted work has none of that
protection — which is the single most useful thing to internalise.

## 2. The model — a graph of snapshots

A **commit** is a complete snapshot of the project at one moment, plus:

- a unique id (SHA hash, e.g. `de233b8`)
- an author and timestamp
- a message
- a pointer to its parent commit

Because each commit points to its parent, the history is a chain:

```
826b35b ── … ── 81cf873 ── 5e1f639 ── f29b089 ── 16a0c80 ── b9316fa ── de233b8
   ↑                                                                      ↑
first commit                                                            main
```

That is this repo's actual history, oldest to newest — ten commits, of which
`git log --oneline` shows the most recent.

A **branch** is not a copy of the project. It is a movable *label pointing at
one commit*. `main` above is just a sticky note on `de233b8`. Creating a branch
writes a 41-byte file — that is why branching is cheap and encouraged.

**HEAD** is a pointer to the branch you currently have checked out. "Checking
out" a branch means: move HEAD, and make the working files match that commit.

## 3. The three areas

This is the part that confuses people most, and every command below makes sense
once it is clear. A file moves through three places:

```
   working tree          index / staging          repository
   (files on disk)         (next commit)        (commit history)
        │                        │                     │
        │──── git add ──────────▶│                     │
        │                        │──── git commit ────▶│
        │◀─────────────── git checkout / restore ──────│
```

- **Working tree** — the actual files you edit.
- **Index (staging area)** — a draft of the next commit. You choose what goes in.
- **Repository** — the permanent, committed history.

The index exists so you can commit *part* of your work. If you fixed a bug and
also renamed some variables, you can stage and commit them separately, giving
two clean, reviewable commits instead of one muddled one.

`git status` shows all three at once:

```
Changes to be committed:        ← in the index, will be in the next commit
Changes not staged for commit:  ← modified on disk, not staged
Untracked files:                ← git has never seen these
```

## 4. Everyday commands

### Look before you act

```bash
git status                    # what has changed, and where it sits
git diff                      # working tree vs index (unstaged changes)
git diff --staged             # index vs last commit (what you're about to commit)
git log --oneline -10         # last 10 commits, one line each
git log --oneline --graph --all   # the branch structure, visually
```

`git status` before and after anything unfamiliar. It is free and it prevents
most mistakes.

### Record work

```bash
git add src/components/BookingForm.jsx    # stage one file
git add supabase/                         # stage a directory
git add -A                                # stage everything, including deletions
git commit -m "Add booking form validation"
```

`git add -p` is worth learning early — it walks you through each change chunk
by chunk and asks whether to stage it. It is the practical way to split messy
work into clean commits.

### Share work

```bash
git push                      # send commits to the remote
git pull                      # fetch remote commits and merge into your branch
git fetch                     # download remote commits WITHOUT merging
```

`git fetch` then `git log --oneline main..origin/main` lets you see what
changed on the remote before it touches your files. `git pull` does both steps
at once, which is convenient but occasionally surprising.

### Branches

```bash
git branch                    # list local branches, * marks current
git switch person-a           # move to an existing branch
git switch -c feature/booking # create a new branch and move to it
git branch -d old-branch      # delete a merged branch
```

`git switch` and `git restore` are the modern, clearer replacements for the
overloaded `git checkout`, which did both jobs and several others.

## 5. Commit messages

A commit message answers "why", because the diff already shows "what". The
convention this repo follows:

```
Show navbar and footer on every React page
Match vanilla booking form to React version
Add profile page components and expand landing/listings
```

Imperative mood ("Add", not "Added" or "Adds"), no trailing period, roughly 50
characters. The imperative reads as an instruction the commit carries out:
*applying this commit will* "show navbar and footer on every React page".

For anything non-obvious, add a body explaining the reasoning:

```bash
git commit -m "Move booking storage to Supabase" -m "localStorage is per-browser, so an artisan could never see requests submitted from another device."
```

The reasoning is the part nobody can reconstruct from the code six months later.

## 6. Branching for a group project

Your repo has `main`, `person-a`, `person-b`. The standard workflow:

**`main` is always working.** Nobody commits to it directly. It is the version
you would demo.

**Each person works on their own branch,** built from an up-to-date `main`:

```bash
git switch main
git pull                          # get everyone else's merged work
git switch -c person-c/booking-form
```

**Merge back through a pull request** so the change is reviewed before it
reaches `main`:

```bash
git push -u origin person-c/booking-form
```

`-u` sets the upstream so later pushes are just `git push`.

Then open a PR on GitHub, or:

```bash
gh pr create --fill
```

### Keeping your branch current

If `main` moves while you work, bring those changes into your branch *before*
opening the PR, so you resolve conflicts on your own branch rather than in the
PR:

```bash
git switch person-c/booking-form
git fetch
git merge origin/main
```

## 7. Merge conflicts

A conflict happens when two branches changed **the same lines** of the same
file. Git will not guess; it stops and asks.

Different lines in the same file merge automatically — conflicts are narrower
than people expect.

The markers look like this:

```
<<<<<<< HEAD
  <button className="submit-btn">Send request</button>
=======
  <button className="submit-btn" disabled={sending}>Send</button>
>>>>>>> origin/main
```

- Above `=======` — your version (the branch you are on)
- Below — the incoming version

To resolve: edit the file so it contains the code you actually want, **delete
all three marker lines**, then:

```bash
git add src/components/BookingForm.jsx
git commit                    # completes the merge
```

The most common bug is committing the `<<<<<<<` markers into the file. Search
for them before committing:

```bash
git diff --check
```

To bail out entirely and try again later:

```bash
git merge --abort
```

## 8. Undoing things

Ordered from safest to most destructive. Read the whole line before running any
of them.

**Discard unstaged changes to one file** — permanent, the edits are not in git:

```bash
git restore src/index.css
```

**Unstage a file** (keeps your edits, removes from index):

```bash
git restore --staged src/index.css
```

**Amend the last commit** — fix the message, or add a forgotten file:

```bash
git add forgotten-file.js
git commit --amend
```

Only amend commits you have **not pushed**. Amending rewrites the commit,
giving it a new id; if others have pulled it, their history diverges from yours.

**Undo a commit but keep the changes** as uncommitted work:

```bash
git reset --soft HEAD~1
```

**Undo a commit and throw the changes away:**

```bash
git reset --hard HEAD~1        # destructive
```

**Undo a commit that is already pushed** — makes a *new* commit reversing it,
so history stays intact and nobody else breaks:

```bash
git revert de233b8
```

`revert` is the safe choice for shared branches. `reset` is for local-only work.

### The recovery command

If you `reset --hard` and regret it, the commits are usually still there for a
couple of weeks:

```bash
git reflog
```

This logs every position HEAD has occupied, including ones no branch points to
any more. Find the commit id and:

```bash
git reset --hard <that-id>
```

This only works for **committed** work. Uncommitted changes destroyed by
`reset --hard` or `restore` are genuinely gone. That asymmetry is the argument
for committing often.

## 9. `.gitignore`, and why it is a security tool

Files listed in `.gitignore` are never tracked:

**`react-app/.gitignore`**

```
node_modules
.env.local
.env
```

Three categories belong here:

- **Regenerable** — `node_modules` (rebuild with `npm install`), `dist`.
  Committing them makes the repo enormous and creates constant conflicts.
- **Machine-specific** — `.DS_Store`, editor config.
- **Secret** — `.env.local`.

That last one is why this matters. `.env.local` holds your Supabase URL and
anon key. `.env.example` is committed instead, with placeholder values, so a
teammate knows what variables to set without receiving your credentials.

**A `.gitignore` does not untrack a file that is already committed.** If you
commit a secret and then add it to `.gitignore`, it stays in the repo and in
every clone of the history. To stop tracking it going forward:

```bash
git rm --cached react-app/.env.local
```

But the value remains in past commits — so treat any pushed secret as
compromised and rotate it. Check before committing:

```bash
git status                    # is the file listed as untracked or staged?
git check-ignore -v react-app/.env.local    # confirm it is actually ignored
```

## 10. Remotes

A **remote** is a named URL for another copy of the repository.

```bash
git remote -v
```

```
origin  https://github.com/edgarnguyo/Find-My-Artisan.git (fetch)
origin  https://github.com/edgarnguyo/Find-My-Artisan.git (push)
```

`origin` is a conventional name, not a keyword. `origin/main` is a
**remote-tracking branch** — your local record of where `main` was on GitHub as
of your last `fetch`. It does not update on its own, which is why
`git log origin/main` can look stale until you `git fetch`.

## 11. Worktrees

Standard git lets you have one branch checked out at a time. A **worktree**
gives you a second working directory attached to the same repository, on a
different branch:

```bash
git worktree list
```

```
.../Find My Artisan                                            de233b8 [main]
.../Find My Artisan/.claude/worktrees/supabase-vite-react-...  de233b8 [claude/supabase-vite-react-setup-4701ee]
```

Two folders, one repository, two branches checked out simultaneously. Useful
for reviewing someone's branch without stashing your own work.

Because they share a repository, a commit made in one is immediately visible to
the other. But files that git ignores — `node_modules`, `.env.local` — exist
only in the worktree where you created them.

```bash
git worktree add ../review-person-a person-a    # create
git worktree remove ../review-person-a          # clean up
```

## 12. Stashing

To put work aside temporarily without committing it:

```bash
git stash                     # shelve all uncommitted changes
git stash list                # see what is shelved
git stash pop                 # bring the most recent back and remove it
```

Useful when you need to switch branches mid-task. But stashes are easy to
forget and invisible in normal history — for anything lasting more than an
hour, a commit on a branch (even a rough one, amended later) is safer.

## 13. Command reference

| Goal | Command |
|---|---|
| What has changed | `git status` |
| See unstaged edits | `git diff` |
| See staged edits | `git diff --staged` |
| Recent history | `git log --oneline -10` |
| Branch structure | `git log --oneline --graph --all` |
| Stage a file | `git add <file>` |
| Stage interactively | `git add -p` |
| Commit | `git commit -m "message"` |
| Fix last commit | `git commit --amend` |
| New branch | `git switch -c <name>` |
| Change branch | `git switch <name>` |
| List branches | `git branch -a` |
| Upload | `git push` (first time: `git push -u origin <branch>`) |
| Download and merge | `git pull` |
| Download only | `git fetch` |
| Discard file edits | `git restore <file>` |
| Unstage a file | `git restore --staged <file>` |
| Undo commit, keep work | `git reset --soft HEAD~1` |
| Undo a pushed commit | `git revert <sha>` |
| Recover lost commits | `git reflog` |
| Who wrote this line | `git blame <file>` |
| Shelve work | `git stash` / `git stash pop` |
| Abandon a merge | `git merge --abort` |

## 14. Habits worth building

**Commit small and often.** A commit is a save point you can return to. Large
commits are hard to review and impossible to partially revert.

**Run `git status` constantly.** Most git accidents come from acting on a wrong
assumption about the current state.

**Never commit secrets or `node_modules`.** Check `git status` before every
commit and look at what is actually staged.

**Pull before you start work.** Starting from a stale `main` guarantees a
harder merge later.

**Write the message for whoever reads it in six months.** Usually that is you.
