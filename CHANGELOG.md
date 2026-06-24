# Changelog

All notable changes to this project will be documented in this file.

## [1.1] - 2026-06-24

Requires **Interactive Video 1.9** or later.

### Added

- **Report — completion detail modal:** When you open a learner’s completion cell, the modal includes profile link (photo/name → Moodle profile in a new tab), **Previous / Next** buttons, and a position counter. Navigation follows the learners currently visible in the filtered/sorted report.
- **Report — XP override:** Teachers with report edit permission can change earned XP from that navigation bar. Overridden scores are **highlighted in the report table**; the learner’s **row total XP** and **gradebook grade** update automatically.
- **Manage Flexbook — Interaction defaults:** Course-level page (course navigation) lists saved per-interaction-type defaults and lets you delete individual defaults.
- **Editor — save course defaults:** Bulk toolbar action **Set as defaults for this course** saves the selected interaction’s settings as the default for that type in the course.
- **Editor — defaults on create:** Drag-and-drop and new interaction forms apply **course-saved defaults** (XP, completion, display options, etc.) when available.
- **Global interactions:** Interaction types configured as global (singleton) stay pinned at the top in the editor, are excluded from the learner navigation sequence and interaction counter, and are handled separately during playback.
- **Editor — import packs:** Drop a `.fbz` pack file onto the editor to import interactions.
- **Video segments:** On the segment replay screen, learners get a **Next** button (as well as Replay) to continue to the next interaction.

### Fixed

- **Chapters:** Global interactions are excluded when listing interactions inside a chapter, so chapter boundaries and progress counts stay correct.
- **Content bank drag-and-drop:** New items respect course defaults for completion settings instead of always forcing completion on.
- **Backup & restore:** Placeholder text in interaction items is decoded after restore (e.g. model viewer “go to interaction” links), so internal navigation works again.

### Improved

- **Report page** uses the shared completion-detail review flow (profile, pager, and XP editing in one modal).
- **Editor drag-and-drop uploads** support larger files with progress feedback, clearer error messages, and a type picker when the file type is ambiguous.

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
