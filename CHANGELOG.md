# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Show chat stats for every player in the room so the desktop sidebar highlights all competitors instead of only the local user.

### Fixed

- Prevent duplicate socket broadcasts so player accuracy streak increments correctly instead of skipping values. (Fixes [#50](https://github.com/hydrabeer/word-bomb/issues/50))
- Reset player accuracy streak when they lose a life so streaks can't persist through mistakes. (Fixes [#54](https://github.com/hydrabeer/word-bomb/issues/54))
