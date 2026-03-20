# Zenobase Web

AngularJS SPA built with Vite, frontend for Zenobase.

## Requirements

- [Node.js](https://nodejs.org/) (v18+)

## Setup

```sh
npm install
```

## Development

Start the Vite dev server:

```sh
npm run dev
```

This serves the app at http://localhost:5173. API requests are proxied to the Play backend at http://localhost:9000, which must be running separately.

## Production Build

```sh
npm run build
```

Output goes to `dist/`. To preview the production build locally:

```sh
npm run preview
```

## Project Structure

```
index.html              Main SPA entry point
admin/index.html        Admin SPA entry point
src/
  main.js               Vite entry (imports CSS + app JS, bootstraps Angular)
  admin.js              Vite entry for admin app
  app/
    zeno.js              Application code
    admin.js             Admin application code
  css/
    zeno.less            Styles (Bootstrap 2, Font Awesome 4.3, app styles)
    bootstrap/           Bootstrap 2 LESS source
public/                  Static assets (served as-is, not processed by Vite)
  js/                    Vendored JS libraries
  partials/              AngularJS templates
  dashboard/             Dashboard widget templates
  fonts/                 Font Awesome webfonts
  img/                   Images
```
