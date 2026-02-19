<div align="center">
<img src="assets/icon.png" width="128" height="128" alt="Neovim Statusline icon">

# Neovim Statusline for VS Code

<a href="https://marketplace.visualstudio.com/items?itemName=why-trv.neovim-statusline"><img src="https://img.shields.io/visual-studio-marketplace/v/why-trv.neovim-statusline?color=bae&label=Visual%20Studio%20Marketplace" alt="Visual Studio Marketplace"></a>
<a href="https://open-vsx.org/extension/why-trv/neovim-statusline"><img src="https://img.shields.io/open-vsx/v/why-trv/neovim-statusline?color=90c&label=Open%20VSX" alt="Open VSX Registry"></a>

</div>

**Neovim Statusline** is a VS Code extension leveraging [Custom UI Style](https://marketplace.visualstudio.com/items?itemName=subframe7536.custom-ui-style)'s CSS and JavaScript injection capabilities to style the UI based on current [VSCode Neovim](https://marketplace.visualstudio.com/items?itemName=asvetliakov.vscode-neovim) mode. Originally written to get a nicer-looking status bar with mode badge, it now also supports styling cursors, current line highlights, and other UI elements per mode.

<div align="center">
<img src="https://github.com/why-trv/vscode-neovim-statusline/blob/assets/neovim-statusline-demo.webp?raw=true" alt="Status bar with the extension">
</div>

## Why not `colorCustomizations`?

There are several extensions that use workspace-scope `colorCustomizations` to style the status bar. This extension takes a different approach that has a number of advantages:

- Doesn't pollute your `.vscode/settings.json` in your workspace.
- Reacts to mode changes instantly.
- Doesn't trigger syntax highlight refresh on mode changes (which looks especially bad with semantic highlighting that takes some time to complete).
- Can style individual UI elements - not just the whole status bar - and in many more ways.

## Prerequisites

The following extensions need to be installed and configured. Please refer to their documentation for details.

- [VSCode Neovim](https://marketplace.visualstudio.com/items?itemName=asvetliakov.vscode-neovim)
- [Custom UI Style](https://marketplace.visualstudio.com/items?itemName=subframe7536.custom-ui-style)

**VSCode Neovim**'s `vscode-neovim.statusLineSeparator` and `vscode-neovim.statusLineItems` settings must remain at their default values, otherwise statusline parsing may not work correctly.

## Configuration

### Defaults

Out of the box, **Neovim Statusline** applies the following styling:

- Turns the mode indicator into a color-coded badge.
- Renders the whole VSCode Neovim statusline in a monospaced font.
- Spaces out the individual statusline parts.
- Changes the cursor color to the mode color.
- Changes the current line highlight to a subtle mix of your editor background and the mode color.
- Changes the current line number color to a subtle mix of its regular color and the mode color.

### Visual Mode Cursor Caveat (!)

The visual mode cursor is a special case: what you see is actually a combination of a thin actual cursor and a fake block cursor decoration using Neovim's `Cursor` highlight group colors ([vscode-neovim/#1883](https://github.com/vscode-neovim/vscode-neovim/issues/1883#issuecomment-2067866983)).

The `%cursor` selector only styles the thin cursor (transparent by default). Since there's no reliable CSS/JS way to distinguish the fake block cursor from other decorations like search highlights, you need to set its color via VSCode Neovim settings or in Neovim itself. For example, in your `settings.json`:

```json
"vscode-neovim.highlightGroups.highlights": {
  "Cursor": {
    "backgroundColor": "#bc9af8",
    "color": "#1a1b26"
  }
}
```

By default, the extension also sets `"%editor .wordHighlightText": { "z-index": -1 }` to make the fake cursor appear on top of word highlight decorations like a real cursor would.

### Basic Configuration

If all you want is to change the mode colors, you can simply redefine the color variables in your `settings.json` like so:

```json
"neovim-statusline.variables": {
  "--nvim-normal-primary": "#0000cc",
  "--nvim-insert-primary": "#00cc00",
  "--nvim-visual-primary": "#cc00cc",
  "--nvim-replace-primary": "#cc0000",
  "--nvim-command-primary": "#cccc00"
}
```

The current line highlight and line number colors are derived from these variables and VS Code theme colors and will change accordingly.

When you change any setting that affects the injected CSS, the Custom UI Style extension will prompt you to restart VS Code to apply the changes.

### Advanced Configuration

The configuration is open-ended by design. Rather than abstracting away the CSS, it provides a thin framework around it.

Here is a list of all available settings:

| Setting                        | Type    | Default   | Description                                                                                                                                                                              |
| ------------------------------ | ------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `neovim-statusline.enabled`    | boolean | `true`    | Turns styling on or off. If disabled, custom CSS and JS imports are removed from Custom UI Style’s `external.imports`                                                                    |
| `neovim-statusline.autoInject` | boolean | `true`    | Automatically add the extension’s CSS/JS paths to Custom UI Style’s `external.imports`. Set to `false` to manage paths yourself (use the **Copy CSS Path** / **Copy JS Path** commands). |
| `neovim-statusline.variables`  | object  | see below | CSS variables to define at `:root` level                                                                                                                                                 |
| `neovim-statusline.styles`     | object  | see below | CSS property values per Neovim mode and UI element selector                                                                                                                              |

#### `neovim-statusline.variables`

These are standard CSS variables, prefixed with `--`. You can redefine the default ones and/or add your own. You can use standard CSS color functions like `rgb()`, `hsl()`, `calc()`, `color-mix()` and so on.

For reference, here are the default values:

```json
{
  "neovim-statusline.variables": {
    "--nvim-normal-primary": "#79a2f8",
    "--nvim-insert-primary": "#9ecf6a",
    "--nvim-visual-primary": "#bc9af8",
    "--nvim-replace-primary": "#f7768e",
    "--nvim-command-primary": "#e0af68"
  }
}
```

#### `neovim-statusline.styles`

Here's an annotated example of what you can do:

```jsonc
{
  "neovim-statusline.styles": {
    // "default" applies to all modes unless overridden by a mode-specific style
    "default": {
      // These are basically your regular CSS rulesets, except we can use a bunch of built-in
      // predefined aliases, namely:
      // - %statusBar - VS Code status bar
      // - %statusBarItem - VSCode Neovim status bar item
      // - %modeBadge - mode badge (NORMAL, INSERT etc.)
      // - %message - the rest of status line (may include visual selection size, command message,
      //              macro recording status, etc.)
      // - %messagePart - individual parts of %message
      // The rest are self-explanatory:
      // - %cursor
      // - %currentLine
      // - %currentLineNumber
      // - %editor
      // - %focusedEditor
      // - %workbench
      // These aliases can be used alone or as a part of your regular CSS selectors.
      "%statusBarItem": {
        // Default monospace font variable provided by Custom UI Style
        "font-family": "var(--cus-mono)",
      },
      "%modeBadge": {
        "color": "var(--vscode-statusBar-background)", // Using theme color variable provided by VS Code
        "padding-left": "5px", // Change badge padding
        "padding-right": "5px",
      },
      // Message parts have their text content doubled in 'data-text' attribute.
      // For example, you can use it to make it really obvious when you're recording a macro:
      "%messagePart[data-text^=\"recording @\"]": {
        "background-color": "#d35ca5", // A bright badge background
        "color": "var(--vscode-statusBar-background)", // Text color to match status bar background
        "font-weight": "bold",
      },
    },
    // Styles for specific modes
    "normal": {
      // Make the current line tint less subtle than the default mix
      "%currentLine": {
        "background-color": "color-mix(in srgb, var(--nvim-normal-primary) 10%, var(--vscode-editor-background))",
      },
    },
    "insert": {
      // You don't have to use the selector aliases if you don't want to.
      // For example, the following is equivalent to "%focusedEditor .monaco-editor-background":
      ".monaco-editor.focused .monaco-editor-background": {
        // This changes the background for the whole editor:
        "background-color": "#112211",
      },
      // And this is the current line in ANY editor:
      ".monaco-editor .view-overlays .current-line": {
        "background-color": "#112f11",
      },
    },
    "visual": {},
    "replace": {
      // Remove the current line highlight override for replace mode:
      "%currentLine": null,
    },
    "command": {
      // Hide the mode badge in command mode:
      "%modeBadge": {
        "display": "none",
      },
    },
  },
}
```

For default settings, please refer to [package.json](package.json).

## Commands

Available via the Command Palette under **Neovim Statusline:**

- **Reload** — Manually regenerate CSS from settings and reload Custom UI Style (requires VS Code restart).
- **Toggle Styling** — Toggle the `neovim-statusline.enabled` setting on or off.
- **Copy CSS Path** — Copy the generated CSS file path to the clipboard (for manual injection when auto-inject is off).
- **Copy JS Path** — Copy the statusline JS file path to the clipboard (for manual injection when auto-inject is off).
