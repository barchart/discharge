const AWS = require("../aws")

module.exports = {
  title: "Create distribution",
  skip: async (context) => {
    let domain = context.config.domain
    let marker
    let distribution

    while (true) {
      const data = await context.cloudFront
        .listDistributions({ MaxItems: "100", ...(marker ? { Marker: marker } : {}) })
    
      const distributions = data?.DistributionList?.Items ?? []
      distribution = distributions.find((d) => (d?.Aliases?.Items ?? []).includes(domain))
    
      if (distribution) {
        break
      }
    
      if (!data?.DistributionList?.IsTruncated) {
        break
      }
    
      marker = data.DistributionList.NextMarker
    }

    if (distribution) {
      return "Distribution already exists"
    } else {
      return false
    }
  },
  task: async (context) => {
    let domain = context.config.domain
    let endpoint = AWS.findEndpointByRegionKey(context.config.aws_region)
    let origin = `${domain}.${endpoint}`
    let certificateARN = context.certificateARN

    await context.cloudFront.createDistribution({
      DistributionConfig: {
        Aliases: {
          Items: [
            domain,
            `www.${domain}`,
          ],
          Quantity: 2,
        },
        CallerReference: new Date().toISOString(),
        Comment: context.config.domain,
        DefaultCacheBehavior: {
          AllowedMethods: {
            Items: [
              "GET",
              "HEAD",
            ],
            Quantity: 2,
          },
          Compress: true,
          ForwardedValues: {
            Cookies: {
              Forward: "none",
            },
            QueryString: false,
          },
          MinTTL: 0,
          TargetOriginId: domain,
          TrustedSigners: {
            Enabled: false,
            Quantity: 0,
          },
          ViewerProtocolPolicy: "redirect-to-https",
        },
        Enabled: true,
        Origins: {
          Items: [{
            CustomOriginConfig: {
              HTTPPort: 80,
              HTTPSPort: 443,
              OriginProtocolPolicy: "http-only",
            },
            DomainName: origin,
            Id: domain,
          }],
          Quantity: 1,
        },
        PriceClass: "PriceClass_100",
        ViewerCertificate: {
          ACMCertificateArn: certificateARN,
          CloudFrontDefaultCertificate: false,
          MinimumProtocolVersion: "TLSv1",
          SSLSupportMethod: "sni-only",
        },
      },
    })
  },
}
