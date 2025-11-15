# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.3] - 2025-11-15

### Fixed
- **Mobile Photo Upload**: Removed `capture="environment"` attribute from file input to allow iOS Safari users to upload existing photos from their gallery instead of being forced to use camera only
- **Improved File Handler**: Updated image upload handler to better handle file arrays and allow re-selecting the same file
- **Red Flag Detection**: Removed overly generic "hi" pattern that caused false positives in legitimate conversations

### Changed
- File input now supports multiple file selection for better user experience
- Removed repetitive disclaimer from AI analysis responses (still available in other app locations)

## [2.1.1] - 2025-11-15

### Fixed
- **Mobile Photo Upload**: Removed `capture="environment"` attribute from file input to allow iOS Safari users to upload existing photos from their gallery instead of being forced to use camera only
- **Improved File Handler**: Updated image upload handler to better handle file arrays and allow re-selecting the same file

### Changed
- File input now supports multiple file selection for better user experience

## [2.1.0] - 2025-XX-XX

### Added
- Advanced threat detection with 50+ scam patterns
- OCR screenshot analysis for text messages
- Enhanced mobile responsiveness
- Accessibility improvements (75px minimum touch targets, ARIA labels, high contrast mode)
- Screenshot help modal with device-specific instructions

### Changed
- Improved UI with accordion-style interface
- Enhanced typing animation for AI responses
- Better error handling and user feedback

### Fixed
- Various mobile usability issues
- Performance optimizations for text analysis
