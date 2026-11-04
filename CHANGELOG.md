# Changelog

All notable changes to PersonalHQ. Versions follow [Semantic Versioning](https://semver.org); while it's 0.x, minor versions may include breaking changes.

## [Unreleased]

### Added
- **Sign-in for MCP apps (OAuth 2.1)** — Claude's custom connectors and other OAuth clients can connect with just the URL: they register themselves, you approve them with your password, and they get short-lived, rotating tokens. Connected apps are listed in Settings › MCP with a Disconnect button; a password reset disconnects them all.
- **App lock** — set a 4-digit PIN in Settings › Profile (confirmed with your password); the lock screen unlocks as soon as you type the 4th digit. After 1, 5, 15 or 60 minutes without use the app asks for it; "Lock now" locks at once. Wrong PINs count toward the sign-in lockout; forgot it? Sign in with your password.
- **Hide wallet balances** — balances show as `****` by default on Finance and Wallets pages; the eye button reveals them until you leave the page.
- **Notifications** — a bell (phone top bar; desktop bottom-left, where sign-out was) lists overdue tasks, tasks due today, reminders that went off and reminders coming up. The badge counts unread; opening the list marks it read on every device.

- **Your time zone** — "today", due dates, reminders, the greeting and month boundaries follow your time zone, not the server's (UTC in Docker). It's taken from your browser the first time and can be changed in Settings › Profile; AI assistants (MCP) use it too.

### Changed
- Phones: the top bar scrolls away with the page, page titles have no icon, and the system bars match the app's background (light/dark and colour theme).
- Desktop: sign out moved to Settings › Profile.
- Finance: the period sits under the title.
- Trackers: a clear "Make your own tracker" button when there are none; on phones the habit calendar fits the screen (last 12 weeks, today in view) and Edit sits beside the title.
- Overview: on phones the date sits on its own line under the greeting.
- Analytics: "Last 3 months" and "Last 6 months" are rolling windows (4 Aug – 4 Nov), not calendar months.

### Fixed
- MCP requests from hosted agents that send an `Origin` header (e.g. Muse) were refused with 403; the bearer token is now the only check.

### Removed
- The copy-and-paste agent prompt in Settings › MCP; agents can't add MCP servers from a chat. Use the Claude Code command or the JSON config instead.

## [0.1.0] — 2026-11-04

First public beta.

### Added
- **Overview** — today at a glance: due and overdue tasks, habits, notes, trackers and a money summary, with quick add.
- **Tasks** — groups shown as a checklist or a board with your own columns, subtasks, labels, notes, due dates and reminders; a swipeable board with column tabs on phones.
- **Notes** — text and checklist notes with colours, pinning, categories, search and an archive.
- **Trackers** — habits with streaks, amounts with goals or limits, readings, days-since counters and mood.
- **Finance** — income, expenses, investments and donations; wallets with transfers and balance adjustments; analytics with charts and period comparisons; paginated history with filters; currency and symbol settings.
- **Themes** — light, dark or system, in Lavender, Ocean, Teal, Forest, Sunset, Rose, Graphite and Liquid Glass.
- **Installable app (PWA)** — app-style navigation, bottom sheets, pull-to-refresh, offline screen and shortcuts.
- **MCP server** with 44 tools, a token-protected endpoint and a copy-and-paste prompt for connecting an agent.
- **Account security** — username and password, sign-in lockout, recovery key, `pnpm reset-password`, security headers.
- **Backup and restore** as a single JSON file.

[0.1.0]: https://github.com/muktoapb/PersonalHQ/releases/tag/v0.1.0
