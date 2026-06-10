# Changeslog

All notable changes to this project will be documented in this file.

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
