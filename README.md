# My Music: a personal music library powered by YouTube

**A private, installable music app. Search YouTube, save tracks to your library, import whole YouTube playlists, and build your own playlists, with a persistent player that keeps playing as you browse.**

![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![YouTube API](https://img.shields.io/badge/YouTube_Data_API-FF0000?style=flat-square&logo=youtube&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white)

---

## Screenshots

<!-- Add images to docs/screenshots/ and uncomment. -->
<!--
| Home | Search | Playlist |
|---|---|---|
| ![](docs/screenshots/home.png) | ![](docs/screenshots/search.png) | ![](docs/screenshots/playlist.png) |
-->

_Screenshots coming soon._

---

## Features

- **YouTube search** through a Cloud Function. The API key never reaches the
  browser, and searches are rate-limited.
- **Import YouTube playlists** in one step
- **Library and playlists.** Save, organise, and play your own collections.
- **Persistent player** using the official YouTube IFrame Player API, with
  Picture-in-Picture support on iOS
- **Accounts** with email and password sign-up, verification, password reset,
  and a password strength meter
- **Your data, your control.** Export all your data or delete your account from
  Settings.
- **Installable PWA** with custom iOS launch screens

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, lucide-react |
| Backend | Firebase Auth, Firestore, Storage, and Cloud Functions |
| Media | YouTube Data API v3 (on the server) and the YouTube IFrame Player API |
| Hosting | Cloudflare Workers static assets |
| Tooling | oxlint, the Node test runner, and Firestore rules tests |

---

## Getting started

```bash
git clone https://github.com/dean1234533/My-Music.git
cd My-Music
npm install
cp .env.example .env   # add your VITE_FIREBASE_* web config
npm run dev
```

### Backend
1. Create a Firebase project with Auth (email/password), Firestore, and Storage.
2. Deploy the rules: `firebase deploy --only firestore:rules,firestore:indexes,storage`
3. Set the YouTube Data API key as a secret, then deploy the functions:
   ```bash
   firebase functions:secrets:set YOUTUBE_API_KEY
   cd functions && npm install && npm run build && cd ..
   firebase deploy --only functions
   ```

### Scripts

```bash
npm run build      # sitemap + typecheck + production build
npm run lint       # oxlint
npm test           # unit tests
npm run check      # everything
```

---

## Project structure

```
src/
  pages/app/     Home, Search, Library, Playlists, PlaylistDetail, Settings
  pages/auth/    sign in/up, forgot password, email actions
  components/, contexts/, services/, lib/
functions/src/   YouTube search + playlist import, account export/delete, user bootstrap
```

---

## Author

Built by **Dean Da Dev**, a UK full-stack developer building web apps, websites,
and AI tools.

🌐 [dean-da-dev.co.uk](https://www.dean-da-dev.co.uk/) · 💼 [More projects](https://www.dean-da-dev.co.uk/portfolio) · 🐙 [GitHub](https://github.com/dean1234533)
