# Split Happens Web

The standalone responsive browser client for Split Happens. This repository owns the React, TypeScript, and Vite implementation deployed to Firebase Hosting.

## Local development

```sh
npm ci
npm run dev
```

## Verification

```sh
npm test
npm run build
npm run test:e2e
```

## Content

Runtime puzzle data and static assets live in `public/`. The stable `/levels.json` and `/daily_schedule.json` paths remain compatible with the iOS content-fetch contract. Future content updates should copy validated documents into this repository before deployment.

## Deployment

```sh
firebase deploy --only hosting
```

The configured Firebase project is `splithappens-cd66e`.
