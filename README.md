# Zenobase Web

Web app frontend for Zenobase.


## Requirements

- [Node.js](https://nodejs.org/) (v24, see `.nvmrc`)
- [pnpm](https://pnpm.io/) — enable via Corepack (bundled with Node):

  ```sh
  corepack enable
  ```

  The exact pnpm version is pinned in `package.json` via the `packageManager` field.


## Setup

```sh
pnpm install
```


## Development

Start the Vite dev server:

```sh
pnpm dev
```

This serves the app at http://localhost:5173. API requests are proxied to the Play backend at http://localhost:9000, which must be running separately.

To instead build and run the app locally in a production-like environment using Docker:

```sh
./run.sh
```

Then visit http://localhost:8080. API calls are directed to the Play backend at http://localhost:9000, which must be running separately.


## Deployment

Pushing to `main` triggers GitHub Action workflows that build the app, upload the assets to S3,
update the CloudFront distribution, and invalidate the CloudFront cache.

Infrastructure changes must be deployed first by running `pulumi up` locally (`webOriginPath` can be left blank).
