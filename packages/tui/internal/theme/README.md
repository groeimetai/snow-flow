# OpenCode Theme System

OpenCode supports a flexible JSON-based theme system that allows users to create and customize themes easily.

## Theme Loading Hierarchy

Themes are loaded from multiple directories in the following order (later directories override earlier ones):

1. **Built-in themes** - Embedded in the binary
2. **User config directory** - `~/.config/opencode/themes/*.json` (or `$XDG_CONFIG_HOME/opencode/themes/*.json`)
3. **Project root directory** - `<project-root>/.opencode/themes/*.json`
4. **Current working directory** - `./.opencode/themes/*.json`

If multiple directories contain a theme with the same name, the theme from the directory with higher priority will be used.

## Creating a Custom Theme

To create a custom theme, create a JSON file in one of the theme directories:

```bash
# For user-wide themes
mkdir -p ~/.config/opencode/themes
vim ~/.config/opencode/themes/my-theme.json

# For project-specific themes
mkdir -p .opencode/themes
vim .opencode/themes/my-theme.json
```

## Theme JSON Format

Themes use a flexible JSON format with support for:

- **Hex colors**: `"#ffffff"`
- **ANSI colors**: `3` (0-255)
- **Color references**: `"primary"` or custom definitions
- **Dark/light variants**: `{"dark": "#000", "light": "#fff"}`

### Example Theme

```json
{
  "$schema": "../theme.schema.json",
  "defs": {
    "brandColor": "#ff6600",
    "darkBg": "#1a1a1a",
    "lightBg": "#ffffff"
  },
  "theme": {
    "primary": "brandColor",
    "secondary": {
      "dark": "#0066ff",
      "light": "#0044cc"
    },
    "accent": 208,
    "text": {
      "dark": "#ffffff",
      "light": "#000000"
    },
    "background": {
      "dark": "darkBg",
      "light": "lightBg"
    },
    "border": {
      "dark": 8,
      "light": 7
    },
    "borderActive": "primary"
  }
}
```

### Color Definitions

The `defs` section (optional) allows you to define reusable colors that can be referenced in the theme.

### Required Theme Colors

At minimum, a theme must define:
- `primary`
- `secondary`
- `accent`
- `text`
- `textMuted`
- `background`

### All Available Theme Colors

- **Base colors**: `primary`, `secondary`, `accent`
- **Status colors**: `error`, `warning`, `success`, `info`
- **Text colors**: `text`, `textMuted`
- **Background colors**: `background`, `backgroundPanel`, `backgroundElement`
- **Border colors**: `border`, `borderActive`, `borderSubtle`
- **Diff colors**: `diffAdded`, `diffRemoved`, `diffContext`, etc.
- **Markdown colors**: `markdownHeading`, `markdownLink`, `markdownCode`, etc.
- **Syntax colors**: `syntaxKeyword`, `syntaxFunction`, `syntaxString`, etc.

See the JSON schema file for a complete list of available colors.

## Built-in Themes

OpenCode comes with several built-in themes:
- `opencode` - Default OpenCode theme
- `tokyonight` - Tokyo Night theme
- `everforest` - Everforest theme
- `ayu` - Ayu dark theme

## Using a Theme

To use a theme, set it in your OpenCode configuration or select it from the theme dialog in the TUI.