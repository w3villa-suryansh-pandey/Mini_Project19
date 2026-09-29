# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## Google Maps address suggestions

To enable Google Places address suggestions on the profile page, set `VITE_GOOGLE_MAPS_API_KEY` in the frontend environment and enable the Maps JavaScript API and Places API for that key. Restrict the key to the app's allowed web origins. Manual address entry works without a key.

## Apryse PDF editor

Set `VITE_APRYSE_LICENSE_KEY` in `frontend/.env.local` to your Apryse WebViewer license key, then restart Vite. The key is used in the browser by WebViewer; use the key Apryse issued for web applications and follow its domain restrictions. Vite copies the required WebViewer assets into `public/lib/webviewer` during development and builds.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
