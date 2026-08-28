# T3 Code Scroll

T3 Code Scroll is a small production fork that remembers the reading position and last meaningful
text selection for every scoped environment/thread pair.

## Data model

The custom and official Windows apps intentionally use the same T3 home (`~/.t3`) and Electron
profile (`%APPDATA%/t3code`). Threads, settings, saved environments, credentials, attachments, and
client state therefore remain the same data rather than copies. Never run both apps at once; the
shared Electron single-instance lock and T3 server port provide additional protection against this.

Reading positions are client-only local storage keyed by the scoped environment/thread key. A remote
work-PC thread opened from this Windows client gets its own remembered position. Positions do not
currently synchronize to another client device because that would require changing the server data
contract and migration path.

Use the desktop shortcut **Abrir T3 Code Scroll** to launch the custom app. It never closes official
T3 Code automatically: when the official app still owns the shared profile, it asks the user to close
it and try again.

## Updating

Close T3 Code Scroll, then double-click `Update-T3-Code-Scroll.cmd`. The updater:

1. refuses to continue if the custom source is dirty;
2. fetches and merges `upstream/main` from `pingdotgg/t3code`;
3. installs the locked dependencies and runs focused checks;
4. builds the optimized x64 Windows package, reusing the official Linux `pty.node` for WSL
   compatibility when it is available; and
5. silently updates only the separately identified T3 Code Scroll installation.

If an upstream edit conflicts with the small custom patch, the updater stops before building or
installing and leaves the conflict visible for Codex to resolve.
