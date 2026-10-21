# GitHermes

GitHub pull requests and issues in a side pane inside Hermes Desktop.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Hermes Desktop: 0.22.2+](https://img.shields.io/badge/hermes%20desktop-0.22.2%2B-6b46c1.svg)](https://hermes-agent.nousresearch.com/docs/user-guide/desktop)

GitHermes puts the review work you already do in a browser tab next to the code you are reading. Open a pull request, read the conversation, check CI, look at the diff hunks, and merge it without leaving the editor. Issues get the same treatment, with label chips in their real colors and a state filter.

There is no server behind it. The plugin calls the `gh` CLI through the host's shell, so anything `gh` can reach, the pane can show, and nothing leaves your machine that GitHub did not already have. No API tokens, no OAuth flow, no usage tracking.

This repository is a fork of [claudiumio/githermes](https://github.com/claudiumio/githermes). Everything upstream ships is here, plus the Inbox and All Issues views, empty states that point at the next step, and a refresh indicator. The plugin id is unchanged, so an upstream install and this one share the same storage and settings.

> **Not an official Nous Research product.** GitHermes is an independent, open-source community plugin. It uses Hermes Desktop's public plugin API and is maintained separately from the Hermes team.

## Table of contents

- [Screenshots](#screenshots)
- [Features](#features)
- [Requirements](#requirements)
- [Install](#install)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Development](#development)
- [Credits](#credits)
- [Contributing](#contributing)
- [License](#license)

## Screenshots

Pull requests, with CI and review status on every row:

![Pull request list with state, CI and review chips](docs/pr-list.png?v=3)

A pull request, from conversation through to merge:

| Conversation | PR detail |
| --- | --- |
| ![Pull request conversation with inline review threads](docs/pr-conversation.png) | ![Pull request detail view](docs/pr-detail.png?v=3) |

Commits and the issue list:

| Commits | Issues |
| --- | --- |
| ![Commit list with lazy-loaded details](docs/pr-commits.png) | ![Issue list with colored label chips](docs/issue-list.png) |

<!--
  New in this fork. Upload these four files to docs/ and delete the comment
  markers around the table to publish it.

| Inbox | All Issues |
| --- | --- |
| ![Inbox grouped into six PR sections](docs/inbox.png) | ![All Issues with four sections](docs/all-issues.png) |

| Refresh indicator | Empty state |
| --- | --- |
| ![Updated a moment ago in the pane header](docs/header-refresh.png) | ![Empty state with a way out](docs/empty-state.png) |
-->

## Features

### Added in this fork

| Feature | What it does |
| --- | --- |
| Inbox tab | Sorts your own PR work into six live sections: needs your review, needs your team's review, your drafts, waiting on review or checks, needs action, ready to merge. Each section carries a count, opens PRs like the list view, and collapses on demand |
| All Issues tab | Assigned to you, created by you, recently updated, and mentioned, each honouring the Open / Closed / All filter. Cards match the Issues list: author avatar, labels, repo and age |
| Empty states | When a list is empty it says why and offers the next step: clear the search, show all items, switch item type, or open the repo on GitHub |
| Collapsible sections | Every section in Inbox and All Issues opens and closes from its header. The state is saved, so a section you hide stays hidden after a restart |
| Refresh indicator | Shows `Updated 2m ago` on a clock icon, and a spinner with `Updating...` while a fetch runs, so a slow query never looks like a stalled one |
| Windows cold start | `bash.exe` discovery retries and caches its result, so the first `gh` call after a reboot works |

The state filter maps onto `gh search` flags, which understand `open` and `closed` only, so "All" leaves the flag off entirely.

### Inherited from upstream

- Pull request list with state pills, diff size, relative timestamps, plus CI and review chips
- Exact `#N` search, so `#42` never matches `#142`
- Repository picker with pins and drag-to-reorder, plus a session chip that follows the branch of the active session
- Conversation view with a timeline rail, GFM subset, task lists, tables and a compact checks strip
- Inline review threads with a `file:line` chip and the matching diff hunk
- Commit list where each row expands to load its body and files on demand
- Unified per-file diffs with line numbers, theme diff colors and an `A`/`D`/`M`/`R` badge
- In-pane merge with squash, merge or rebase, optional branch deletion
- Label chips drawn in the label's own color with black or white text picked by luminance
- Theming through the desktop app's own variables, so both light and dark themes come for free

## Requirements

- Hermes Desktop 0.22.2 or newer
- The [GitHub CLI](https://cli.github.com/), installed and signed in. Check with `gh auth status`

There is no build step and no dependency of its own to install.

## Install

```bash
hermes plugins install justinbrenton/githermes --enable
```

The app picks up the plugin on its next start. If the pane does not appear, run `Open GitHub pane` from the command palette first.

Prefer to do it by hand? Copy the one file:

```bash
mkdir -p ~/.hermes/desktop-plugins/githermes
cp desktop/plugin.js ~/.hermes/desktop-plugins/githermes/plugin.js
```

The app hot-reloads the file on save, which makes edits quick to test.

### Updating

```bash
hermes plugins update githermes
```

If you installed by hand, copy `desktop/plugin.js` over the old file. Nothing else needs to move.

### Uninstalling

```bash
hermes plugins remove githermes
```

That removes the install. Plugin storage is namespaced by id, so removing and reinstalling clears the saved repository selection.

### Already on `claudiumio/githermes` or `github-prs`?

Remove the old install first. The `github-prs` era used a different plugin id, so an old copy can sit beside the new one without complaint while doing nothing useful. For an upstream install the ids match, which means two copies fight over the same storage:

```bash
hermes plugins remove githermes       # claudiumio install
hermes plugins install justinbrenton/githermes --enable
```

The saved repository selection resets when the id changes. That is a one-time cost.

## Usage

Open the pane from the GitHub entry in the sidebar, or run `Open GitHub pane` in the command palette. Pick a repository in the header, then work through the tabs:

| Tab | What it is for |
| --- | --- |
| PRs | Every open pull request in the repository, filterable by Open / Closed / All |
| Issues | The repository's issues, same filter |
| Inbox | Your own PR work, grouped by what it needs from you, in collapsible sections |
| All Issues | Issues assigned to you, created by you, recently updated, or mentioning you, in collapsible sections |

Search applies to all four tabs, including the sections inside Inbox and All Issues. `#214` jumps straight to that item and never matches `#1214`. `author:octocat` and `label:bug` narrow the list, and quoted values work when the value has a space. Anything else filters on number, title, author, branch or label.

Keyboard shortcuts are few and predictable: `/` puts the cursor in the search box, `Escape` clears the query, and `Enter` opens the result when the search has narrowed the list to one row.

In Inbox and All Issues each section header is a button: the caret on the left collapses that section, whether it has rows or not. The choice is written to plugin storage and survives a reload, which keeps a quiet section from taking up space all day.

Merging happens in the pane. Open a pull request, use the Merge action, choose squash, merge or rebase, and optionally delete the branch. The confirmation panel shows what will happen before it does.

Two commands worth knowing, both in the command palette:

- `GitHub: Open page` opens the full-page view instead of the docked pane
- `GitHub: Toggle opening chat links in pane` decides whether GitHub links you click in chat open in the pane or in your browser

## Troubleshooting

### The pane says it cannot load repositories

Run `gh auth status` in a terminal. The plugin inherits whatever `gh` has, so an expired token shows up here first.

### Nothing happens when a row is clicked

Check that the repository in the picker is the one you expect. The pane scopes every query to the selected repo, and a stale selection looks like a broken click.

### Windows: the first load after boot fails, then works

Fixed in this fork. Update to the latest commit; the fix caches the resolved `bash.exe` path after the first successful probe.

### The pane is missing entirely

Confirm the plugin is installed and enabled with `hermes plugins list`. If you copied the file by hand, check that it landed at `~/.hermes/desktop-plugins/githermes/plugin.js` and not one directory higher.

## Limitations

- "Needs your team's review" needs a `gh` token with the `read:org` scope, because it reads your team list first. Without it that section stays empty while the other five keep working.
- All Issues caps each section at 30 results and Mentioned at 5. The pane is built for one screen of rows, not a paginated archive.
- No column customization, bulk actions, saved filters, command palette for pane actions, or multi-repo switcher. Those are ideas, not promises.
- The Windows work covers `bash.exe` discovery only. Nothing else in the plugin is platform-specific.

## Development

The plugin is a single file, `desktop/plugin.js`, loaded uncompiled. The UI is written with `jsx()` and `jsxs()` calls rather than JSX syntax, because the desktop runtime loads the file directly with no build step in front of it.

Two rules matter when editing:

- Only the modules Hermes provides at runtime are importable. Nothing is installed from npm, and there is no bundler to resolve a stray import.
- Keep ternaries and inline `.map()` calls out of `children` arrays. The plugin loader rejects forms that a plain syntax check accepts, so build rows into variables first and pass the variable.

Tailwind classes have to exist in the app's compiled CSS already. Arbitrary `var()` bracket forms such as `bg-[var(--x)]` are silently dead at runtime; use the paren shorthand, `text-(--ui-text-tertiary)`, or a scoped `<style>` block with real theme variables.

## Credits

GitHermes is built and maintained by [claudiumio](https://github.com/claudiumio). This fork adds the Inbox and All Issues views, the empty states and the Windows cold-start fix on top of that work. The plugin manifest still names claudiumio as author and points at the upstream repository, so the plugin id and its storage namespace stay the same for anyone moving between the two installs.

## Contributing

Issues and pull requests are welcome. Open an issue before starting anything large, so the shape of the change can be agreed first. Bug reports land faster with the pane's error text, your platform, and the output of `gh --version` and `hermes --version`.

The upstream project documents its own conventions in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
