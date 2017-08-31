# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2017-08-31
### Added
- add MongoDB registry example

## [0.4.0] - 2017-08-04
### Fixed
- writeAttributes misses 'stp' attribute
- return 403 when registration client is rejected
- validate update registration query
### Added
- add examples/battery-level.js
- add coveralls
### Changed
- test coverage now is performed with nyc (part of istanbul.js)
### Security
- stop using deprecated Buffer API (unsafe)

## [0.1.0] - 2017-07-27
