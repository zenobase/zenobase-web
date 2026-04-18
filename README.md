# Zenobase Web

TypeScript / Vue.js SPA frontend for [zenobase](https://github.com/zenobase/zenobase/), deployed to [zenobase.com](https://zenobase.com/).


## Getting Started

1. Check out and run [the backend](https://github.com/zenobase/zenobase/) with Docker Compose
2. Install Node.js (see `.nvmrc`) with pnpm via Corepack (`corepack enable`)
3. Run `pnpm install` to install dependencies
4. Run `pnpm dev` to start a dev server at http://localhost:5173
5. `./run.sh` serves a full build at http://localhost:8080


## Development

- Check your code with `pnpm lint`, `pnpm typecheck`, and `pnpm test`; a pre-commit hook runs the first two checks automatically
- Pushing to `main` triggers GitHub Actions workflows that run all checks, build the app, upload the assets to S3, update the CloudFront distribution, and invalidate the CloudFront cache
- Changes to [infra/](./infra/) must be deployed first by running `pulumi up` locally (`webOriginPath` can be left blank)
