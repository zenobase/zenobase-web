# Zenobase Web

Web app frontend for Zenobase.


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

To instead build and run the app locally in a production-like environment using Docker:

```sh
./run.sh
```

Then visit http://localhost:8080. API calls are directed to the Play backend at http://localhost:9000, which must be running separately.


## Deployment

Pushing to `main` triggers a [GitHub Actions workflow](.github/workflows/build.yml) that builds the app and uploads `dist/` to S3 under `/<git-sha>/`.

To deploy a specific build, set `webOriginPath` to the SHA and run `pulumi up`:

```sh
cd infra
pulumi config set webOriginPath /<git-sha>
pulumi up
```

This points the CloudFront distribution at the new build. Then invalidate the CloudFront cache:

```sh
aws cloudfront create-invalidation --distribution-id $(pulumi stack output distributionId) --paths "/*"
```

To roll back, set `webOriginPath` to a previous SHA, `pulumi up`, and invalidate again.
