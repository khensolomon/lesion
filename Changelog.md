# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog,
and this project adheres to Semantic Versioning.

## [21-34] - 2026-01-23

Improve

- apps
  - refactor to modern ES6 class syntax with GObject registration, and restructure the preferences page to use a class-based approach with a compatibility wrapper
  - Drag and Drop (DND) controllers for sorting
- Replace the hover scaling animation with a smoother opacity transition.
- corners code
- Panels (style)
  - ES6
  - Backward compatibility wrapper
  - Copyable setting for presets
- Log message [*] enabling manager

Remove

- ShowApps
- corners

## [1-21] - 2025-12-08

Add

- Initial stable release.
- Preferences window for managing stylesheets.
- Functionality to list and toggle bundled CSS styles from the ./style directory.
- Functionality for users to add their own custom CSS files from any location.
- For each custom style, users can:
- Enable or disable it with a toggle.
- Open the file in the default editor.
- Remove the file from the management list.
- Centralizing Configuration & logs
