# Changeslog

All notable changes to this project will be documented in this file.

## Unreleased

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
