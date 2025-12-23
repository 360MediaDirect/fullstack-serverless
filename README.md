# fullstack-serverless

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm version](https://badge.fury.io/js/%40360mediadirect%2Ffullstack-serverless.svg)](https://badge.fury.io/js/%40360mediadirect%2Ffullstack-serverless)
[![MIT licensed](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/360MediaDirect/fullstack-serverless/master/LICENSE)
[![npm downloads](https://img.shields.io/npm/dt/%40360mediadirect%2Ffullstack-serverless.svg?style=flat)](https://www.npmjs.com/package/%40360mediadirect%2Ffullstack-serverless)
[![Test Coverage](https://img.shields.io/badge/coverage-96.8%25-brightgreen.svg)](https://github.com/360MediaDirect/fullstack-serverless)

> A production-ready [Serverless Framework](http://www.serverless.com) plugin that automatically creates an AWS CloudFront distribution serving static web content from S3 with optional API Gateway routing.

## ✨ Features

### Core Functionality
- **Custom Domain Support** - Set up custom domains for both S3-hosted sites and API Gateway
- **Free SSL/TLS** - Automatic SSL certificate management via AWS Certificate Manager
- **No CORS Issues** - Serve static content and API from the same domain
- **CDN Caching** - CloudFront caching reduces Lambda invocations and API Gateway traffic
- **Enhanced Monitoring** - Comprehensive CloudWatch statistics including bandwidth metrics
- **Access Logging** - Real-world [Apache-style access logs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/AccessLogs.html)
- **WAF Integration** - Built-in [Web Application Firewall](https://aws.amazon.com/waf/) support for threat protection
- **Flexible Deployment** - Works with or without API Gateway functions

### Security & Quality
- **96.8% Test Coverage** - Comprehensive test suite ensuring reliability
- **Security Hardened** - Protected against command injection and path traversal attacks
- **Modern Dependencies** - Up-to-date, secure dependency versions
- **Path Traversal Protection** - Built-in safeguards against directory traversal exploits

## 📋 Prerequisites

- **Serverless Framework** - Install globally:
  ```bash
  npm install -g serverless
  ```
- **AWS Account** - [Configure your AWS credentials](https://serverless.com/framework/docs/providers/aws/guide/credentials/)
- **Node.js** - Version 4.0 or higher (recommend 18+ for best security)

## 🚀 Getting Started

### Installation

Install the plugin as a development dependency:

```bash
npm install --save-dev @360mediadirect/fullstack-serverless
```

### Basic Configuration

* All fullstack-serverless configuration parameters are optional - e.g. don't provide ACM Certificate ARN
  to use default CloudFront certificate (which works only for default cloudfront.net domain).
* This plugin **does not** set-up automatically Route53 for newly created CloudFront distribution.
  After creating CloudFront distribution, manually add Route53 ALIAS record pointing to your
  CloudFront domain name.
* First deployment may be quite long (e.g. 10 min) as Serverless is waiting for
  CloudFormation to deploy CloudFront distribution.


Add the plugin to your `serverless.yml`:

```yaml
plugins:
  - '@360mediadirect/fullstack-serverless'

custom:
  fullstack:
    bucketName: webapp-deploy                  # Required: Unique S3 bucket name
    distributionFolder: client/dist            # Optional: Path to client assets (default: client/dist)
    domain: my-custom-domain.com              # Optional: Custom domain
    certificate: arn:aws:acm:us-east-1:...    # Optional: ACM certificate ARN for SSL
    indexDocument: index.html                  # Optional: Index document (default: index.html)
    errorDocument: error.html                  # Optional: Error document (default: error.html)
    singlePageApp: false                       # Optional: SPA routing support (default: false)
    compressWebContent: true                   # Optional: Enable compression (default: true)
    apiPath: api                               # Optional: API path prefix (default: api)
    minimumProtocolVersion: TLSv1.2_2021      # Optional: Minimum TLS version (recommended: TLSv1.2_2021)
    priceClass: PriceClass_100                # Optional: CloudFront price class
    waf: arn:aws:wafv2:...                    # Optional: WAF ARN for protection
    logging:
      bucket: my-bucket.s3.amazonaws.com
      prefix: my-prefix
    invalidationPaths:                         # Optional: CloudFront invalidation paths
      - /index.html
      - /error.html
```

### Quick Start

**1. Create your website folder**

Create a website folder in the root directory of your Serverless project:

```bash
mkdir -p client/dist
echo "<!DOCTYPE html><html><body><h1>Go Serverless!</h1></body></html>" > client/dist/index.html
echo "<!DOCTYPE html><html><body><h1>Error Page</h1></body></html>" > client/dist/error.html
```

**2. Deploy your stack**

```bash
serverless deploy
```

⏱️ **Note:** First deployment takes ~10 minutes as CloudFormation creates the CloudFront distribution.

The plugin will output your CloudFront distribution URL when complete.

⚠️ **Warning:** The plugin will overwrite existing bucket contents unless you use `--no-delete-contents`.

### Common Commands

```bash
# Deploy everything (infrastructure + client)
serverless deploy

# Deploy only client files
serverless client deploy

# Deploy without deleting existing S3 content
serverless client deploy --no-delete-contents

# Deploy without generating client (skip clientCommand)
serverless client deploy --no-generate-client

# Remove the deployed stack
serverless client remove
```

### Configuration Parameters

**bucketName**

_required_

```yaml
custom:
  fullstack:
    ...
    bucketName: [unique-s3-bucketname]
    ...
```

Use this parameter to specify a unique name for the S3 bucket that your files will be uploaded to.

---

**distributionFolder**

_optional_, default: `client/dist`

```yaml
custom:
  fullstack:
    ...
    distributionFolder: [path/to/files]
    ...
```

Use this parameter to specify the path that contains your website files to be uploaded. This path is relative to the path that your `serverless.yaml` configuration files resides in.

---

**apiPath**

_optional_, default: `api`

```yaml
custom:
  fullstack:
    ...
    apiPath: api
    ...
```

Use this parameter to specify the path prefix your API Gateway methods will be available through on your CloudFront distribution (custom domain)

* If `http` events are defined, `apiPath` must be included in the path for the lambdas you want exposed through CloudFront (your custom domain). Not all your methods need to be exposed through CloudFront. For some things, esp. those that are not public facing (eg. third party web hooks) you may want to use the ApiGateway URL and not expose them through CloudFront to control access and cost.

```yaml
functions:
  message:
    handler: message.handler
    timeout: 30
    events:
      - http:
        path: ${self:custom.fullstack.apiPath}/message
        method: post
        integration: lambda
```

---

**apiGatewayRestApiId**

_optional_, default: `not set`

```yaml
custom:
  fullstack:
    ...
    apiGatewayRestApiId: a12bc34df5
    ...
```

This is only needed if "Api Gateway Rest Api" is not part of the same serverless template and the API id is not defined in [provider -> apiGateway](https://serverless.com/framework/docs/providers/aws/events/apigateway/#share-api-gateway-and-api-resources) section.
The id can be found in API Gateway url. For example, if your Rest API url is `https://a12bc34df5.execute-api.eu-central-1.amazonaws.com`, API id will be `a12bc34df5`. 

---

**certificate**

_optional_, default: `not set`

```yaml
custom:
  fullstack:
    ...
    certificate: arn:aws:acm:us-east-1:...
    ...
```

Use this parameter to specify ARN for the SSL cert to use form AWS CertificateManager

---

**indexDocument**

_optional_, default: `index.html`

```yaml
custom:
  fullstack:
    ...
    indexDocument: [file-name.ext]
    ...
```

The name of your index document inside your `distributionFolder`. This is the file that will be served to a client visiting the base URL for your website.

---

**domain**

_optional_, default: `not set`

```yaml
custom:
  fullstack:
    ...
    domain: my-custom-domain.com
    ...
```

`domain` can be a list, if you want to add more domains:
```yaml
custom:
  fullstack:
    ...
    domain:
    - my-custom-domain.com
    - secondary-custom-domain.com
    ...
```

The custom domain for your fullstack serverless app.

---

**errorDocument**

_optional_, default: `error.html`

```yaml
custom:
  fullstack:
    ...
    errorDocument: [file-name.ext]
    ...
```

The name of your error document inside your `distributionFolder`. This is the file that will be served to a client if their initial request returns an error (e.g. 404). For an SPA, you may want to set this to the same document specified in `indexDocument` so that all requests are redirected to your index document and routing can be handled on the client side by your SPA.

---

**objectHeaders** 

_optional_, no default

```yaml
custom:
  fullstack:
    ...
    objectHeaders:
      ALL_OBJECTS:
        - name: header-name
          value: header-value
        ...
      specific-directory/:
        - name: header-name
          value: header-value
        ...
      specific-file.ext:
        - name: header-name
          value: header-value
        ...
      ... # more file- or folder-specific rules
    ...
```

Use the `objectHeaders` option to set HTTP response headers be sent to clients requesting uploaded files from your website. 

Headers may be specified globally for all files in the bucket by adding a `name`, `value` pair to the `ALL_OBJECTS` property of the `objectHeaders` option. They may also be specified for specific folders or files within your site by specifying properties with names like `specific-directory/` (trailing slash required to indicate folder) or `specific-file.ext`, where the folder and/or file paths are relative to `distributionFolder`. 

Headers with more specificity will take precedence over more general ones. For instance, if 'Cache-Control' was set to 'max-age=100' in `ALL_OBJECTS` and to 'max-age=500' in `my/folder/`, the files in `my/folder/` would get a header of 'Cache-Control: max-age=500'.

---

**singlePageApp**

_optional_, default: `false`

```yaml
custom:
  fullstack:
    ...
    singlePageApp: true
    ...
```

If true 403 errors will be rerouted (missing assets) to your root index document to support single page apps like React and Angular where the js framework handles routing
    
---

**invalidationPaths**

_optional_, default: `['/*']`

```yaml
custom:
  fullstack:
    ...
    invalidationPaths:
      - /index.html
      - /error.html
    ...
```

Custom invalidationPaths for cloudfront in case your frontend framework uses filename hashing
    
---

**compressWebContent**

_optional_, default: `true`

```yaml
custom:
  fullstack:
    ...
    compressWebContent: true
    ...
```

Instruct CloudFront to use compression when serving web content, see [Serving Compressed Files](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ServingCompressedFiles.html) in the Amazon CloudFront Developer Guide.
    
---

**clientCommand**

_optional_, default: `not set`

```yaml
custom:
  fullstack:
    ...
    clientCommand: [command to generate your client (e.g. gulp dist)]
    ...
```

Command to generate the client assets. Defaults to doing nothing
       
---

**clientSrcPath**

_optional_, default: `not set`

```yaml
custom:
  fullstack:
    ...
    clientSrcPath: [path/to/your/client]
    ...
```

The path to where you want to run the `clientCommand`    
       
---

**waf**

_optional_, default: `not set`

```yaml
custom:
  fullstack:
    ...
    waf: [web application firewall ARN]
    ...
```

[Web Application Firewall](https://aws.amazon.com/waf/) support - enable AWS WAF to protect your API from security threats
         
---

**logging**

_optional_, default: `not set`

```yaml
custom:
  fullstack:
    ...
    logging:
      bucket: my-bucket.s3.amazonaws.com
      prefix: my-prefix
    ...
```

Real world [access log](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/AccessLogs.html) - out of the box, API Gateway currently does not provide any kind of real "apache-like" access logs for your invocations
         
---

**priceClass**

_optional_, default: `PriceClass_All`

```yaml
custom:
  fullstack:
    ...
    priceClass: PriceClass_100
    ...
```

CloudFront [PriceClass](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PriceClass.html) - can be PriceClass_All (default), PriceClass_100 or PriceClass_200

---

**minimumProtocolVersion**

_optional_, default: `TLSv1`

```yaml
custom:
  fullstack:
    ...
    minimumProtocolVersion: TLSv1.2_2018
    ...
```

Set minimum SSL/TLS [protocol version](https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_ViewerCertificate.html#cloudfront-Type-ViewerCertificate-MinimumProtocolVersion) - `TLSv1_2016`, `TLSv1.1_2016`, `TLSv1.2_2018` or `SSLv3`

- The minimum SSL/TLS protocol that CloudFront uses to communicate with viewers
- The cipher that CloudFront uses to encrypt the content that it returns to viewers

---

**noConfirm**

_optional_, default: `false`

```yaml
custom:
  fullstack:
    ...
    noConfirm: true
    ...
```

Use this parameter if you do not want a confirmation prompt to interrupt automated builds. If either this or `--no-confirm` CLI parameter is true the confirmation prompt will be disabled. 

---

**origins**

_optional_, default: `not set`

```yaml
custom:
  fullstack:
    ...
    origins:
      - Id: Media
        DomainName: 
          Fn::GetAtt:
            - MediaBucket
            - DomainName
        S3OriginConfig:
          OriginAccessIdentity:
            Fn::Join:
              - ''
              - - origin-access-identity/cloudfront/
                - { Ref: S3OriginAccessIdentity }
    ...
```

Use this parameter if you want to add additional origins to the CloudFormation resources.

---

**defaultCacheBehavior**

_optional_, default: `not set`

```yaml
custom:
  fullstack:
    ...
    defaultCacheBehavior:
      MinTTL: 3600
    ...
```

---

**cacheBehaviors**

_optional_, default: `not set`

```yaml
custom:
  fullstack:
    ...
    cacheBehaviors:
      - TargetOriginId: Media
        PathPattern: media/*
        AllowedMethods:
          - GET
          - HEAD
          - OPTIONS
        CachedMethods:
          - HEAD
          - GET
        ForwardedValues:
          QueryString: true
          Headers:
            - Accept
            - Referer
            - Authorization
            - Content-Type
        ViewerProtocolPolicy: redirect-to-https
        ...
    ...
```

Use this parameter if you want to add additional cache behaviors to the CloudFormation resources.

---

### Command-line Parameters


**--no-delete-contents**

_optional_, default `false` (deletes contents by default)

```bash
serverless client deploy --no-delete-contents
```

Use this parameter if you do not want to delete the contents of your bucket before deployment. Files uploaded during deployment will still replace any corresponding files already in your bucket.

---

**--no-generate-client**

_optional_, default `false` (generates client code by default if `clientCommand` and `clientSrcPath` are configured)

```bash
serverless client deploy --no-generate-client
```

Use this parameter if you do not want to generate the client code before deploying. Files uploaded during deployment will still replace any corresponding files already in your bucket.

---

**--no-client-deploy**

_optional_, default `false` (deploys the generated client code by default)

```bash
serverless deploy --no-client-deploy
```

Use this parameter if you do not want to deploy the client along with the rest of the serverless stack. Almost certainly in this case you don't want to generate the client code either and will want to use 
```bash
serverless deploy --no-generate-client --no-client-deploy
```

---

**--no-confirm**

_optional_, default `false` (disables confirmation prompt)

```bash
serverless client deploy --no-confirm
```

Use this parameter if you do not want a confirmation prompt to interrupt automated builds.

---

**--no-invalidate-distribution**

_optional_, default `false` (disables creating an invalidation for the CloudFront distribution)

```bash
serverless client deploy --no-invalidate-distribution
```

Use this parameter if you do not want to invalidate the CloudFront distribution. Invalidations are  for the path `/*`.

---

## 🔒 Security

This plugin has been hardened against common security vulnerabilities:

### Security Features

- **Command Injection Protection** - Spawn operations use `shell: false` to prevent command injection attacks
- **Path Traversal Protection** - File operations validate paths to prevent directory traversal
- **Secure Dependencies** - All dependencies updated to latest secure versions:
  - `js-yaml` v4.1.0+ (fixes CVE-2019-20149 code execution vulnerability)
  - `lodash` v4.17.21+ (fixes prototype pollution vulnerabilities)
  - All other dependencies updated to secure versions

### Security Best Practices

1. **Use TLS 1.2 or higher** - Set `minimumProtocolVersion: TLSv1.2_2021` in your config
2. **Enable WAF** - Configure AWS WAF to protect against common web exploits
3. **Use SSL Certificates** - Always use ACM certificates for custom domains
4. **Regular Updates** - Keep the plugin and dependencies up to date
5. **Principle of Least Privilege** - Use IAM roles with minimal required permissions

### Reporting Security Issues

If you discover a security vulnerability, please email security reports to the maintainers or open a private security advisory on GitHub.

## 🧪 Development & Testing

This plugin includes a comprehensive test suite with **96.8% code coverage**.

### Running Tests

```bash
# Install dependencies
npm install

# Run tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with verbose output
npm run test:verbose
```

### Test Coverage

- **Unit Tests**: 151 tests across all modules
- **Coverage**: 96.8% overall
  - index.js: 98.05%
  - bucketUtils.js: 100%
  - cloudFront.js: 100%
  - validate.js: 100%
  - upload.js: 82.22%
  - getFileList.js: 93.33%

### Contributing

Contributions are welcome! Please ensure:
1. All tests pass (`npm test`)
2. Coverage remains above 95%
3. Code follows existing style conventions
4. Security best practices are followed

---

## 📝 Changelog

### v0.8.4 - Security & Testing Release

**Security Fixes:**
- 🔒 Fixed critical command injection vulnerability in spawn operations
- 🔒 Added path traversal protection to file operations
- 🔒 Updated `js-yaml` from v3.10.0 to v4.1.0 (fixes CVE-2019-20149)
- 🔒 Updated `lodash` from v4.13.1 to v4.17.21 (fixes prototype pollution)
- 🔒 Updated all dependencies to latest secure versions

**Testing & Quality:**
- ✅ Added comprehensive test suite with 96.8% coverage
- ✅ 151 unit tests across all modules
- ✅ Added Jest testing framework with full mocking support
- ✅ Configured coverage thresholds (95% minimum)

**API Changes:**
- Updated `yaml.safeLoad()` to `yaml.load()` for js-yaml v4 compatibility

---

## 👥 Maintainers
- Andy Hahn - [andrewphahn](https://github.com/andrewphahn) from [_MadSkills.io_](http://madskills.io)

## 🤝 Contributors
- [jlaramie](https://github.com/jlaramie)
- [superandrew213](https://github.com/superandrew213)
- [harmon25](https://github.com/harmon25)
- [jmortlock](https://github.com/jmortlock)
- [haochang](https://github.com/haochang)
- [hakimio](https://github.com/hakimio)
- [artoliukkonen](https://github.com/artoliukkonen)
- [pecirep](https://github.com/pecirep)
- [miguel-a-calles-mba](https://github.com/miguel-a-calles-mba)

## 🙏 Credits

This plugin builds on the excellent work of:
- [**serverless-api-cloudfront**](https://github.com/Droplr/serverless-api-cloudfront/) - Original plugin inspiration
- [**serverless-finch**](https://github.com/fernando-mc/serverless-finch/) - S3 deployment patterns
- [**Full Stack Serverless Web Apps with AWS**](https://medium.com/99xtechnology/full-stack-serverless-web-apps-with-aws-189d87da024a/) - CloudFormation templates
- [**serverless-stack.com**](https://serverless-stack.com/) - Serverless best practices

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details
