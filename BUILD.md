# Build and Packaging Guide

## Development Build

For development with hot reloading:
```bash
npm run dev
```

For a one-time development build:
```bash
npm run build:dev
```

## Production Build

To create a production build:
```bash
npm run build
```

This will:
- Clean the `dist` directory
- Build with production optimizations (minification, no source maps)
- Exclude development files like .DS_Store

## Packaging for Chrome Web Store

To create a complete package ready for Chrome Web Store submission:
```bash
npm run package
```

This will:
1. Run a clean production build
2. Create a zip file named `fastgpt-extension-v{version}.zip`
3. The zip contains all necessary files for Chrome Web Store submission

## Version Management

To update the extension version:

- Patch version (1.0.0 → 1.0.1): `npm run version:patch`
- Minor version (1.0.0 → 1.1.0): `npm run version:minor`
- Major version (1.0.0 → 2.0.0): `npm run version:major`

After updating the version, run `npm run package` to create a new package with the updated version number.

## Build Output

The production build creates:
- `dist/popup.js` - Minified popup interface code
- `dist/background.js` - Minified background script
- `dist/popup.html` - Popup HTML file
- `dist/popup.css` - Popup styles
- `dist/manifest.json` - Extension manifest
- `dist/assets/` - Extension icons

## Chrome Web Store Submission

The generated zip file contains all necessary files for Chrome Web Store submission:
1. Upload the `fastgpt-extension-v{version}.zip` file to Chrome Web Store Developer Dashboard
2. Fill in the required store listing information
3. Submit for review

## Build Optimizations

The production build includes:
- Code minification and compression
- Asset optimization
- Exclusion of development files
- Proper source map handling (disabled in production)
- Code splitting for better performance