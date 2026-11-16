import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config();
const certificateArn = config.require("certificateArn");
const webOriginPath = config.get("webOriginPath") || "";
const apiHostname = config.get("apiHostname") || "";

const accountId = aws.getCallerIdentityOutput().accountId;
const region = aws.getRegionOutput().region;

function denyInsecureTransport(bucketArn: string) {
    return {
        Sid: "DenyInsecureTransport",
        Effect: "Deny",
        Principal: "*",
        Action: "s3:*",
        Resource: [bucketArn, `${bucketArn}/*`],
        Condition: { Bool: { "aws:SecureTransport": "false" } },
    };
}

// Private, ACL-less, versioned bucket with a lifecycle rule
function privateBucket(name: string, lifecycle: { noncurrentDays: number; expirationDays?: number }) {
    const bucket = new aws.s3.Bucket(name, { bucket: name });
    new aws.s3.BucketPublicAccessBlock(name, {
        bucket: bucket.id,
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
    });
    new aws.s3.BucketOwnershipControls(name, {
        bucket: bucket.id,
        rule: { objectOwnership: "BucketOwnerEnforced" },
    });
    const versioning = new aws.s3.BucketVersioning(name, {
        bucket: bucket.id,
        versioningConfiguration: { status: "Enabled" },
    });
    new aws.s3.BucketLifecycleConfiguration(name, {
        bucket: bucket.id,
        rules: [{
            id: "expire",
            status: "Enabled",
            filter: {},
            ...(lifecycle.expirationDays ? { expiration: { days: lifecycle.expirationDays } } : {}),
            noncurrentVersionExpiration: { noncurrentDays: lifecycle.noncurrentDays },
            abortIncompleteMultipartUpload: { daysAfterInitiation: 7 },
        }],
    }, { dependsOn: versioning });
    return bucket;
}

// Access logs for the web bucket (S3 server access logs) and CloudFront (logging v2)
const logBucket = privateBucket("zenobase-web-logs", { expirationDays: 90, noncurrentDays: 1 });
// S3 access logs go under s3/; CloudFront logs under the AWS-managed AWSLogs/<account>/CloudFront/
const s3LogPrefix = "s3";

// Web app assets
const bucket = privateBucket("zenobase-web", { noncurrentDays: 30 });

new aws.s3.BucketLogging("zenobase-web", {
    bucket: bucket.id,
    targetBucket: logBucket.id,
    targetPrefix: `${s3LogPrefix}/`,
});

// CloudFront OAC
const oac = new aws.cloudfront.OriginAccessControl("zenobase-web", {
    name: "zenobase-web",
    originAccessControlOriginType: "s3",
    signingBehavior: "always",
    signingProtocol: "sigv4",
});

// CloudFront function to redirect www → apex and rewrite subdirectory URLs to index.html
// (defaultRootObject only applies to the root URL, not subdirectories)
const rewriteFunction = new aws.cloudfront.Function("rewrite-uri", {
    name: "zenobase-web-rewrite-uri",
    runtime: "cloudfront-js-2.0",
    code: `
function handler(event) {
    var request = event.request;
    if (request.headers.host.value === 'www.zenobase.com') {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { location: { value: 'https://zenobase.com' + request.uri } },
        };
    }
    var uri = request.uri;
    if (uri.endsWith('/')) {
        request.uri += 'index.html';
    } else if (!uri.includes('.')) {
        request.uri += '/index.html';
    }
    return request;
}
`,
});

// Standalone www → apex redirect for cache behaviors that don't use the rewrite function
const wwwRedirect = new aws.cloudfront.Function("www-redirect", {
    name: "www-redirect",
    runtime: "cloudfront-js-2.0",
    code: `
function handler(event) {
    if (event.request.headers.host.value === 'www.zenobase.com') {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { location: { value: 'https://zenobase.com' + event.request.uri } },
        };
    }
    return event.request;
}
`,
});

// Custom security headers policy (replaces Managed-SecurityHeadersPolicy, adding CSP and Permissions-Policy)
const securityHeadersPolicy = new aws.cloudfront.ResponseHeadersPolicy("zenobase-web-security-headers", {
    name: "zenobase-web-security-headers",
    securityHeadersConfig: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: "DENY", override: true },
        xssProtection: { override: true, protection: true, modeBlock: true },
        strictTransportSecurity: {
            override: true,
            accessControlMaxAgeSec: 63072000,
            includeSubdomains: false,
            preload: false,
        },
        referrerPolicy: {
            override: true,
            referrerPolicy: "strict-origin-when-cross-origin",
        },
        contentSecurityPolicy: {
            override: true,
            contentSecurityPolicy: [
                "default-src 'none'",
                "script-src 'self' https://maps.googleapis.com",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "img-src 'self' https://maps.gstatic.com https://*.googleapis.com data:",
                "font-src 'self' https://fonts.gstatic.com",
                "connect-src 'self' https://api.zenobase.com https://auth.zenobase.com https://*.sentry.io https://*.googleapis.com",
                "worker-src blob:",
                "child-src blob:",
                "frame-src https://auth.zenobase.com",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "frame-ancestors 'none'",
            ].join("; "),
        },
    },
    customHeadersConfig: {
        items: [{
            header: "Permissions-Policy",
            value: [
                "accelerometer=()",
                "autoplay=()",
                "camera=()",
                "cross-origin-isolated=()",
                "display-capture=()",
                "encrypted-media=()",
                "fullscreen=()",
                "geolocation=(self)",
                "gyroscope=()",
                "keyboard-map=()",
                "magnetometer=()",
                "microphone=()",
                "midi=()",
                "payment=()",
                "picture-in-picture=()",
                "publickey-credentials-get=()",
                "screen-wake-lock=()",
                "sync-xhr=(self)",
                "usb=()",
                "xr-spatial-tracking=()",
            ].join(", "),
            override: true,
        }],
    },
});

// CloudFront distribution
const distribution = new aws.cloudfront.Distribution("zenobase-web", {
    origins: [
        {
            domainName: bucket.bucketRegionalDomainName,
            originId: "s3",
            originPath: webOriginPath,
            originAccessControlId: oac.id,
        },
        ...(apiHostname ? [{
            domainName: apiHostname,
            originId: "api",
            customOriginConfig: {
                httpPort: 80,
                httpsPort: 443,
                originProtocolPolicy: "https-only",
                originSslProtocols: ["TLSv1.2"],
            },
        }] : []),
    ],
    enabled: true,
    defaultRootObject: "index.html",
    aliases: ["zenobase.com", "www.zenobase.com"],
    viewerCertificate: {
        acmCertificateArn: certificateArn,
        sslSupportMethod: "sni-only",
        minimumProtocolVersion: "TLSv1.2_2021",
    },
    // Proxy backend routes that are accessed via browser navigation
    // (not $http), so they bypass the apiBaseUrlInterceptor:
    // - /oauth/callback/* — third-party OAuth providers redirect here
    // - /to — outbound redirect links in the frontend (<a href="/to?url=...">)
    orderedCacheBehaviors: apiHostname ? [
        {
            pathPattern: "/oauth/callback/*",
            allowedMethods: ["GET", "HEAD", "OPTIONS"],
            cachedMethods: ["GET", "HEAD"],
            targetOriginId: "api",
            viewerProtocolPolicy: "redirect-to-https",
            forwardedValues: {
                queryString: true,
                cookies: { forward: "none" },
            },
            functionAssociations: [{
                eventType: "viewer-request",
                functionArn: wwwRedirect.arn,
            }],
            defaultTtl: 0,
            minTtl: 0,
            maxTtl: 0,
        },
        {
            pathPattern: "/to",
            allowedMethods: ["GET", "HEAD", "OPTIONS"],
            cachedMethods: ["GET", "HEAD"],
            targetOriginId: "api",
            viewerProtocolPolicy: "redirect-to-https",
            forwardedValues: {
                queryString: true,
                cookies: { forward: "none" },
            },
            functionAssociations: [{
                eventType: "viewer-request",
                functionArn: wwwRedirect.arn,
            }],
            defaultTtl: 0,
            minTtl: 0,
            maxTtl: 0,
        },
    ] : [],
    defaultCacheBehavior: {
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        cachedMethods: ["GET", "HEAD"],
        targetOriginId: "s3",
        viewerProtocolPolicy: "redirect-to-https",
        compress: true,
        forwardedValues: {
            queryString: false,
            cookies: { forward: "none" },
        },
        responseHeadersPolicyId: securityHeadersPolicy.id,
        functionAssociations: [{
            eventType: "viewer-request",
            functionArn: rewriteFunction.arn,
        }],
    },
    httpVersion: "http2and3",
    priceClass: "PriceClass_100",
    restrictions: {
        geoRestriction: {
            restrictionType: "none",
        },
    },
}, webOriginPath ? {} : { ignoreChanges: ["origins"] });

// S3 bucket policy — TLS only, allow CloudFront OAC access
new aws.s3.BucketPolicy("zenobase-web", {
    bucket: bucket.id,
    policy: pulumi.all([bucket.arn, distribution.arn]).apply(([bucketArn, distArn]) =>
        JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                denyInsecureTransport(bucketArn),
                {
                    Sid: "AllowCloudFrontOAC",
                    Effect: "Allow",
                    Principal: { Service: "cloudfront.amazonaws.com" },
                    Action: "s3:GetObject",
                    Resource: `${bucketArn}/*`,
                    Condition: {
                        StringEquals: {
                            "AWS:SourceArn": distArn,
                        },
                    },
                },
            ],
        }),
    ),
});

// Log bucket policy — TLS only, allow S3 server access logging and CloudWatch Logs vended log delivery
const logBucketPolicy = new aws.s3.BucketPolicy("zenobase-web-logs", {
    bucket: logBucket.id,
    policy: pulumi.all([logBucket.arn, bucket.arn, accountId, region]).apply(([logArn, webArn, account, logsRegion]) =>
        JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                denyInsecureTransport(logArn),
                {
                    Sid: "AllowS3ServerAccessLogs",
                    Effect: "Allow",
                    Principal: { Service: "logging.s3.amazonaws.com" },
                    Action: "s3:PutObject",
                    Resource: `${logArn}/${s3LogPrefix}/*`,
                    Condition: {
                        ArnLike: { "aws:SourceArn": webArn },
                        StringEquals: { "aws:SourceAccount": account },
                    },
                },
                {
                    Sid: "AWSLogDeliveryAclCheck",
                    Effect: "Allow",
                    Principal: { Service: "delivery.logs.amazonaws.com" },
                    Action: "s3:GetBucketAcl",
                    Resource: logArn,
                    Condition: {
                        StringEquals: { "aws:SourceAccount": account },
                        ArnLike: { "aws:SourceArn": `arn:aws:logs:${logsRegion}:${account}:delivery-source:*` },
                    },
                },
                {
                    Sid: "AWSLogDeliveryWrite",
                    Effect: "Allow",
                    Principal: { Service: "delivery.logs.amazonaws.com" },
                    Action: "s3:PutObject",
                    Resource: `${logArn}/AWSLogs/${account}/*`,
                    Condition: {
                        StringEquals: { "s3:x-amz-acl": "bucket-owner-full-control", "aws:SourceAccount": account },
                        ArnLike: { "aws:SourceArn": `arn:aws:logs:${logsRegion}:${account}:delivery-source:*` },
                    },
                },
            ],
        }),
    ),
});

// CloudFront standard logging v2 → S3 (works with BucketOwnerEnforced, unlike legacy logging, which needs ACLs)
const cloudFrontLogSource = new aws.cloudwatch.LogDeliverySource("zenobase-web-cloudfront", {
    name: "zenobase-web-cloudfront",
    logType: "ACCESS_LOGS",
    resourceArn: distribution.arn,
});

const cloudFrontLogDestination = new aws.cloudwatch.LogDeliveryDestination("zenobase-web-cloudfront", {
    name: "zenobase-web-cloudfront",
    outputFormat: "w3c",
    deliveryDestinationConfiguration: {
        destinationResourceArn: logBucket.arn,
    },
});

new aws.cloudwatch.LogDelivery("zenobase-web-cloudfront", {
    deliverySourceName: cloudFrontLogSource.name,
    deliveryDestinationArn: cloudFrontLogDestination.arn,
}, { dependsOn: logBucketPolicy });

// GitHub Actions IAM role
const oidcProvider = aws.iam.getOpenIdConnectProvider({
    url: "https://token.actions.githubusercontent.com",
});

const githubActionsRole = new aws.iam.Role("GitHubActionsZenobaseWeb", {
    name: "GitHubActionsZenobaseWeb",
    assumeRolePolicy: oidcProvider.then(provider =>
        JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
                Effect: "Allow",
                Principal: { Federated: provider.arn },
                Action: "sts:AssumeRoleWithWebIdentity",
                Condition: {
                    StringEquals: {
                        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                    },
                    StringLike: {
                        "token.actions.githubusercontent.com:sub": "repo:zenobase/zenobase-web:*",
                    },
                },
            }],
        }),
    ),
});

new aws.iam.RolePolicy("GitHubActionsZenobaseWeb", {
    role: githubActionsRole.id,
    policy: pulumi.all([bucket.arn, distribution.arn]).apply(([bucketArn, distArn]) =>
        JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: ["s3:PutObject", "s3:DeleteObject"],
                    Resource: `${bucketArn}/*`,
                },
                {
                    Effect: "Allow",
                    Action: "s3:ListBucket",
                    Resource: bucketArn,
                },
                {
                    Effect: "Allow",
                    Action: [
                        "cloudfront:CreateInvalidation",
                        "cloudfront:GetDistribution",
                        "cloudfront:GetDistributionConfig",
                        "cloudfront:UpdateDistribution",
                        "cloudfront:ListTagsForResource",
                    ],
                    Resource: distArn,
                },
                {
                    Effect: "Allow",
                    Action: [
                        "iam:ListOpenIDConnectProviders",
                        "iam:GetOpenIDConnectProvider",
                    ],
                    Resource: "*",
                },
            ],
        }),
    ),
});

export const bucketName = bucket.bucket;
export const logBucketName = logBucket.bucket;
export const distributionId = distribution.id;
export const domainName = distribution.domainName;
export const githubActionsRoleArn = githubActionsRole.arn;
