# GitHermes

Pull requests and issues in a side pane inside Hermes Desktop.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Hermes Desktop: 0.22.2+](https://img.shields.io/badge/hermes%20desktop-0.22.2%2B-6b46c1.svg)](https://hermes-agent.nousresearch.com/docs/user-guide/desktop)

GitHermes puts the review work you already do in a browser tab beside the code you are reading. Open a pull request, read the conversation, check CI, walk the diff, and merge it without leaving the editor. Issues get the same treatment, with label chips in their real colors and an open, closed or all filter.

There is no server behind it. The pane calls the `gh` CLI through Hermes and shows what `gh` returns. No API tokens to paste, no OAuth flow, no telemetry.

This repository is a fork of [claudiumio/githermes](https://github.com/claudiumio/githermes). Everything upstream ships is here, plus an Inbox for your own review queue, an All Issues view, shared card layout and empty states. The plugin id is unchanged, so an upstream install and this one share storage.

> **Not an official Nous Research product.** GitHermes is an independent, open-source community plugin. It uses the Hermes Desktop plugin API and is maintained separately from the Hermes team.

## Table of contents

- [Screenshots](#screenshots)
- [Features](#features)
- [Requirements](#requirements)
- [Install](#install)
- [Updating](#updating)
- [Uninstalling](#uninstalling)
- [Coming from upstream](#coming-from-upstream)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Development](#development)
- [Credits](#credits)
- [Contributing](#contributing)
- [License](#license)

## Screenshots

Pull requests:

![Pull request list with state, CI and review chips](docs/pr-list.png?v=3)

A pull request, from conversation to merge:

| Conversation | PR detail |
| --- | --- |
| ![Pull request conversation with inline review threads](docs/pr-conversation.png) | ![Pull request detail view](docs/pr-detail.png?v=3) |

Commits and issues:

| Commits | Issues |
| --- | --- |
| ![Commit list with lazy-loaded details](docs/pr-commits.png) | ![Issue list with colored label chips](docs/issue-list.png) |

<!--
  Pending: docs/inbox.png, docs/all-issues.png, docs/header-refresh.png, docs/empty-state.png

| Inbox | All Issues |
| --- | --- |
| ![Inbox sections](docs/inbox.png) | ![All Issues sections](docs/all-issues.png) |

| Refresh indicator | Empty state |
| --- | --- |
| ![Refresh indicator](docs/header-refresh.png) | ![Empty state](docs/empty-state.png) |
-->

## Features

### Added in this fork

| Feature | What it does |
| --- | --- |
| Inbox | Six sections for your own PR work: needs your review, needs your team's review, your drafts, waiting, needs action, ready to merge. It spans every repository, not just the one in the header |
| All Issues | Issues assigned to you, created by you, recently updated, and mentioning you, each honouring the Open, Closed and All filter |
| One card per item type | PRs and Inbox share one card, and Issues and All Issues share another. Same order, same identifiers, so a row reads the same wherever you meet it |
| Clickable filters | Author and label chips are buttons on every row in all four tabs. A click fills the search box with `author:name` or `label:name` |
| Empty states | An empty list says why, then offers a way out: clear the search, show all items, switch item type, or open the repository |
| Collapsible sections | Inbox and All Issues sections fold from their header, and the choice survives a restart |
| Refresh indicator | The header shows when the data last updated, and switches to `Updating...` while a fetch runs |

### Inherited from upstream

- Pull request list with state pills, diff size, CI and review chips
- Exact `#N` search, so `#42` never matches `#142`
- Repository picker with pins and drag to reorder, plus a chip for the session branch
- Conversation view with a timeline rail, a GFM subset, tables and a checks strip
- Inline review threads with a `file:line` chip and the matching diff hunk
- Commit list and per-file diffs, both loaded on demand
- In-pane merge with squash, merge or rebase, and optional branch deletion
- Label chips in the label's own color, with text chosen by contrast

## Requirements

- Hermes Desktop 0.22.2 or newer
- The [GitHub CLI](https://cli.github.com/), installed and signed in. Check with `gh auth status`
- An open chat, because Hermes runs shell commands inside a chat session

No build step, no dependencies of its own.

## Install

```bash
hermes plugins install justinbrenton/githermes --enable
```

Restart the app and open the pane from the GitHub entry in the sidebar. If it does not appear, run `Open GitHub pane` from the command palette.

To install by hand, copy the plugin file into the directory the app reads:

```bash
# macOS and Linux
mkdir -p ~/.hermes/desktop-plugins/githermes
cp desktop/plugin.js ~/.hermes/desktop-plugins/githermes/plugin.js
```

```powershell
# Windows
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\hermes\desktop-plugins\githermes"
Copy-Item desktop\plugin.js "$env:LOCALAPPDATA\hermes\desktop-plugins\githermes\plugin.js"
```

## Updating

```bash
hermes plugins update githermes
```

If you installed by hand, copy `desktop/plugin.js` over the old file. Nothing else needs to move.

## Uninstalling

```bash
hermes plugins remove githermes
```

Plugin storage is namespaced by id, so removing and reinstalling clears the saved repository and your collapsed sections.

## Coming from upstream

Remove the old install first. An upstream install uses the same plugin id, so two copies fight over the same storage. The older `github-prs` era used a different id, so an old copy can sit beside the new one doing nothing.

```bash
hermes plugins remove githermes
hermes plugins install justinbrenton/githermes --enable
```

The saved repository selection resets when the id changes, which is a one-time cost.

## Usage

Open the pane from the GitHub entry in the sidebar, or run `Open GitHub pane`. Pick a repository in the header:

| Tab | What it is for |
| --- | --- |
| PRs | Open pull requests in the selected repository, filterable by Open, Closed or All |
| Issues | The repository's issues, same filter |
| Inbox | Your own PR work across every repository, grouped by what it needs from you |
| All Issues | Issues assigned to you, created by you, recently updated, or mentioning you |

A pull request row shows state, number and title, author, labels, branch, added and removed lines, file count, age, and CI and review chips. An issue row shows title, labels, author and age. Author and label chips fill the search box when clicked.

Search reaches all four tabs, including sections inside Inbox and All Issues. `#214` jumps to that item and never matches `#1214`. `author:octocat`, `label:bug` and `repo:owner/name` narrow the list, and quoted values work when a value has a space.

Shortcuts are few. `/` focuses the search box, `Escape` clears the query, and `Enter` opens the result when one row is left.

Merging happens in the pane. Choose squash, merge or rebase, and optionally delete the branch. The confirmation panel shows what will happen first.

Two commands sit in the command palette:

- `GitHub: Open page` opens the full-page view instead of the docked pane
- `GitHub: Toggle opening chat links in pane` decides whether GitHub links from chat open in the pane or the browser

## Troubleshooting

### The pane cannot load repositories

Run `gh auth status`. The plugin inherits whatever `gh` has, so an expired or missing token shows up here first.

### The pane asks you to start a chat

Hermes runs shell commands inside a chat session. Send a message in any chat and the view fills in on its own.

### The lists are empty but the repository has work in it

Check the search box. A leftover query filters every tab at once. `Escape` clears it.

### The pane is missing entirely

Confirm the plugin is installed and enabled with `hermes plugins list`. If you copied the file by hand, check that it landed at `desktop-plugins/githermes/plugin.js`, not one directory higher.

## Limitations

- "Needs your team's review" reads your team list first, which needs a `gh` token with the `read:org` scope. Without it that section stays empty while the other five work.
- Inbox covers open pull requests only.
- Inbox sections cap at 50 rows. The issue sections cap at 30, and Mentioned at 5.
- No column customization, bulk actions, saved filters or multi-repo switcher.

## Development

The plugin is one file, `desktop/plugin.js`, loaded as written. No bundler, nothing to compile.

- Import only what Hermes provides at runtime. A stray npm package will not resolve.
- Use the parenthesized color syntax the app understands, such as `text-(--ui-text-tertiary)`. Bracket forms like `bg-[var(--x)]` fail quietly.
- Build rows into variables before passing them to a children array. Some inline forms pass a syntax check and still fail inside the app.

## Credits

GitHermes is built and maintained by [claudiumio](https://github.com/claudiumio). This fork adds the Inbox and All Issues views, the shared card layout and the empty states. The manifest still names claudiumio as author and points at the upstream repository, which keeps the plugin id and its storage in place for anyone switching between installs.

## Contributing

Issues and pull requests are welcome. Open an issue before starting anything large. A bug report lands faster with the pane's error text, your platform, and the output of `gh --version` and `hermes --version`.

Upstream documents its own conventions in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
