# Zenobase Web

Web app frontend for Zenobase.


## Requirements

- Node.js 24 (see `.nvmrc`) with pnpm via Corepack (`corepack enable`)


## Setup

```sh
pnpm install
```


## Development

Start the Vite dev server:

```sh
pnpm dev
```

This serves the app at http://localhost:5173. API requests are proxied to the backend at http://localhost:9000, which must be running separately.

To instead build and run the app locally in a production-like environment using Docker:

```sh
./run.sh
```

Then visit http://localhost:8080. API calls are directed to the backend at http://localhost:9000, which must be running separately.


## Deployment

Pushing to `main` triggers GitHub Action workflows that build the app, upload the assets to S3,
update the CloudFront distribution, and invalidate the CloudFront cache.

Infrastructure changes must be deployed first by running `pulumi up` locally (`webOriginPath` can be left blank).
