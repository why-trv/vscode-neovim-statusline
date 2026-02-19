# Changelog

## [0.2.1](https://github.com/why-trv/vscode-neovim-statusline/compare/v0.2.0...v0.2.1) - 2026-02-20

- Documentation updates

## [0.2.0](https://github.com/why-trv/vscode-neovim-statusline/compare/v0.1.2...v0.2.0) - 2026-02-20

Complete rework of the extension architecture.

- Flexible style options using predefined %-aliases, allowing for arbitrary CSS selectors
- CSS custom properties (aka variables) via `variables` configuration
- Changes to which elements and attributes are injected with JS
- Reorganized settings structure with elements nested inside mode objects
- `enabled` setting to control whether styling is active
- Auto settings migration from v0.1.x configuration format
- Minified build output

## [0.1.2](https://github.com/why-trv/vscode-neovim-statusline/compare/v0.1.1...v0.1.2) - 2026-02-15

- Removed `extensionDependencies` to prevent installation issues

## [0.1.1](https://github.com/why-trv/vscode-neovim-statusline/compare/v0.1.0...v0.1.1) - 2026-02-15

- Updated README with Marketplace and Open VSX Registry badges
- Replaced demo images

## [0.1.0](https://github.com/why-trv/vscode-neovim-statusline/releases/tag/v0.1.0) - 2026-02-14

- Initial release with color-coded Neovim mode badge and padded command/message display in the status bar
