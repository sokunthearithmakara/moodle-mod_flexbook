# Changeslog

All notable changes to this project will be documented in this file.

## 1.0.2 - 2026-06-16

### Added

- Embed preview from edit mode: Ctrl+click navigation targets open the interaction in player mode via `embed.php` inside the standard modal shell.
- `state.saveInteractionData({ force: true })` for immediate persistence when needed.

### Changed

- Removed control-bar interaction dot indicators; prev/next navigation and the chapter panel are the primary navigation affordances.
- Interaction counter excludes chapters and respects per-type visibility rules; hides when there is nothing to count.
- Control bar uses a balanced three-column layout with centered prev/next buttons.
- Updated clickability and visibility language strings to refer to the chapter panel instead of the control bar.
- Dropped the `interactionbar` appearance option from activity settings and site defaults.

### Fixed

- `formatContent` runs template JavaScript returned with the format-text fragment.
- Navigation timing: defer incomplete-interaction redirects until the current transition finishes; animate out before updating the counter.
- End-screen interaction counter shows the final position.
- Embed preview iframe sizing and embed-mode player height.
- RTL play-button centering and distraction-free chapter-panel layout in default mode.

## 1.0.1 - 2026-06-10

### Fixed

- Interaction item files were saved to `text1`/`text2`/`text3` file areas instead of `itext1`/`itext2`/`itext3`. Item embedded files belong in `itext*` (backup, copy, and delete already used those areas); `text*` file areas are reserved for learner log payloads. Updated compatible interaction plugins: `local_fbboard`, `local_ivggb`, `local_ivh5pupload`, `local_ivquiz`, and `local_ivvrtour`. Re-upload item files that were saved under the old areas if needed.

## 1.0 - 2026-06-08

First stable release.

### Added

- Instructions sidebar with editor-configurable content per interaction.
- Header actions kebab menu (share, fullscreen, chapter toggle, and related actions).
- Embed mode for displaying individual interactions (`embed.php`).
- Khmer language pack.

### Fixed

- Navigation regression when chapter interactions trigger recursive annotation navigation.
- Mustache validation for instructions toggle `aria-controls` (set dynamically in AMD).
- ESLint and Stylelint issues in AMD modules and `styles.css`.
