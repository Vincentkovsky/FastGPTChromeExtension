# FastGPT Chrome Extension

A Chrome extension that provides seamless access to your FastGPT knowledge base directly from your browser.

## Project Structure

```
├── src/
│   ├── popup/           # Extension popup interface
│   │   ├── popup.html   # Popup HTML template
│   │   ├── popup.css    # Popup styles
│   │   └── popup.ts     # Popup TypeScript logic
│   ├── background/      # Background script
│   │   └── background.ts # Service worker for extension lifecycle
│   └── assets/          # Extension icons and assets
│       ├── icon16.png   # 16x16 icon
│       ├── icon48.png   # 48x48 icon
│       └── icon128.png  # 128x128 icon
├── dist/                # Built extension files
├── manifest.json        # Chrome extension manifest v3
├── package.json         # Node.js dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── webpack.config.js    # Webpack build configuration
```

## Development

### Prerequisites
- Node.js (v16 or higher)
- npm

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the extension:
   ```bash
   npm run build
   ```

3. For development with auto-rebuild:
   ```bash
   npm run dev
   ```

### Loading the Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `dist` folder
4. The FastGPT extension should now appear in your extensions

## Build Scripts

- `npm run build` - Production build
- `npm run dev` - Development build with watch mode
- `npm run clean` - Clean the dist directory

## Chrome Extension Manifest V3

This extension uses Manifest V3 with the following permissions:
- `storage` - For storing user configuration and chat history
- `activeTab` - For accessing the current tab when needed
- `host_permissions` - For making API calls to FastGPT instances

## Next Steps

This is the basic project structure. The next tasks will implement:
1. Storage management and state system
2. Onboarding flow interface
3. Configuration management
4. FastGPT API client
5. Chat interface components