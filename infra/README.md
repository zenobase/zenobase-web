# Infrastructure

## Prerequisites

- AWS account with CLI configured
- Pulumi (`brew install pulumi`) with a Pulumi Cloud account
- Node.js (see `../.nvmrc`) with pnpm via Corepack (`corepack enable`)


## AWS: GitHub OIDC Identity Provider

Create a GitHub OIDC provider (once per AWS account) so GitHub Actions can assume AWS roles without long-lived credentials. Skip if already created for another project.

```sh
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

## AWS: ACM Certificate

Check for an existing certificate:

```sh
aws acm list-certificates --region us-east-1
```

If none exists, request one:

```sh
aws acm request-certificate \
  --domain-name zenobase.com \
  --subject-alternative-names "*.zenobase.com" \
  --validation-method DNS \
  --region us-east-1
```

Complete DNS validation by adding the CNAME/ALIAS records shown in the output. Note the certificate ARN for Pulumi config.


## Pulumi: Initial Setup

```sh
cd infra
pnpm install
pulumi stack init prod
```

Set the certificate ARN in `Pulumi.prod.yaml`:

```sh
pulumi config set certificateArn <arn>
```


## Bootstrap

1. Run `pulumi up` to create all infrastructure (S3 bucket, CloudFront distribution, GitHub Actions IAM role).
2. Set GitHub Actions variables:
   ```sh
   gh variable set AWS_ROLE_ARN --body "$(pulumi stack output githubActionsRoleArn)"
   gh variable set AWS_REGION --body "us-east-1"
   gh variable set S3_BUCKET --body "$(pulumi stack output bucketName)"
   ```
3. Create a DNS CNAME record pointing `zenobase.com` to the CloudFront distribution (`pulumi stack output domainName`).
4. Push to `main` to trigger the CI workflow (builds and uploads to S3).
