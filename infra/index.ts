import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config();
const certificateArn = config.require("certificateArn");
const webOriginPath = config.get("webOriginPath") || "";

// S3 bucket
const bucket = new aws.s3.Bucket("zenobase-web", {
    bucket: "zenobase-web",
});

new aws.s3.BucketPublicAccessBlock("zenobase-web", {
    bucket: bucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
});

// CloudFront OAC
const oac = new aws.cloudfront.OriginAccessControl("zenobase-web", {
    name: "zenobase-web",
    originAccessControlOriginType: "s3",
    signingBehavior: "always",
    signingProtocol: "sigv4",
});

// Look up the managed SecurityHeadersPolicy
const securityHeadersPolicy = aws.cloudfront.getResponseHeadersPolicy({
    name: "Managed-SecurityHeadersPolicy",
});

// CloudFront distribution
const distribution = new aws.cloudfront.Distribution("zenobase-web", {
    origins: [{
        domainName: bucket.bucketRegionalDomainName,
        originId: "s3",
        originPath: webOriginPath,
        originAccessControlId: oac.id,
    }],
    enabled: true,
    defaultRootObject: "index.html",
    aliases: ["zenobase.com"],
    viewerCertificate: {
        acmCertificateArn: certificateArn,
        sslSupportMethod: "sni-only",
        minimumProtocolVersion: "TLSv1.2_2021",
    },
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
        responseHeadersPolicyId: securityHeadersPolicy.then(p => p.id),
    },
    httpVersion: "http2and3",
    priceClass: "PriceClass_100",
    restrictions: {
        geoRestriction: {
            restrictionType: "none",
        },
    },
});

// S3 bucket policy — allow CloudFront OAC access
new aws.s3.BucketPolicy("zenobase-web", {
    bucket: bucket.id,
    policy: pulumi.all([bucket.arn, distribution.arn]).apply(([bucketArn, distArn]) =>
        JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
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
            }],
        }),
    ),
});

export const bucketName = bucket.bucket;
export const distributionId = distribution.id;
export const domainName = distribution.domainName;
