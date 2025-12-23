const ServerlessFullstackPlugin = require('../index');
const fs = require('fs');
const yaml = require('js-yaml');

jest.mock('fs');
jest.mock('js-yaml');

describe('ServerlessFullstackPlugin - Additional Coverage', () => {
  let plugin;
  let serverless;
  let cliOptions;
  let mockResources;

  beforeEach(() => {
    mockResources = {
      Resources: {
        ApiDistribution: {
          Properties: {
            DistributionConfig: {
              Origins: [
                { Id: 'ApiGateway', OriginPath: '' },
                { Id: 'WebApp', S3OriginConfig: {}, DomainName: 'test' }
              ],
              CacheBehaviors: [
                { TargetOriginId: 'ApiGateway', PathPattern: '' }
              ],
              DefaultCacheBehavior: {},
              Logging: {},
              ViewerCertificate: {},
              CustomErrorResponses: [{ ErrorCode: '403' }]
            }
          }
        },
        WebAppS3Bucket: {
          Properties: {
            BucketName: 'test-bucket',
            WebsiteConfiguration: {
              IndexDocument: 'index.html',
              ErrorDocument: 'error.html'
            }
          }
        },
        WebAppS3BucketPolicy: {
          Properties: {
            PolicyDocument: {
              Statement: [
                { Sid: 'AllowPublicRead' },
                { Sid: 'OAIGetObject' }
              ]
            }
          }
        },
        S3OriginAccessIdentity: {}
      }
    };

    serverless = {
      classes: {
        Error: Error
      },
      service: {
        service: 'test-service',
        custom: {
          fullstack: {
            bucketName: 'test-bucket',
            domain: 'example.com',
            certificate: 'arn:aws:acm:us-east-1:123456789:certificate/abc',
            logging: {
              bucket: 'logs.example.com',
              prefix: 'cloudfront/'
            },
            waf: 'arn:aws:wafv2:us-east-1:123456789:global/webacl/test/abc',
            priceClass: 'PriceClass_100',
            apiPath: 'api/v1',
            singlePageApp: true,
            minimumProtocolVersion: 'TLSv1.2_2021',
            compressWebContent: true,
            origins: [{ Id: 'CustomOrigin', DomainName: 'custom.example.com' }],
            cacheBehaviors: [{ PathPattern: '/custom/*', TargetOriginId: 'CustomOrigin' }],
            defaultCacheBehavior: { MinTTL: 0 }
          }
        },
        provider: {
          stage: 'prod',
          apiGateway: {
            restApiId: 'abc123'
          },
          compiledCloudFormationTemplate: {
            Resources: {
              ApiDistribution: {
                Properties: {
                  DistributionConfig: {
                    Origins: [],
                    CacheBehaviors: []
                  }
                }
              }
            }
          }
        }
      },
      config: {
        servicePath: '/test/project'
      },
      cli: {
        log: jest.fn(),
        consoleLog: jest.fn()
      },
      getProvider: jest.fn().mockReturnValue({
        naming: {
          getStackName: jest.fn().mockReturnValue('test-stack'),
          getApiGatewayName: jest.fn().mockReturnValue('test-api')
        },
        request: jest.fn()
      }),
      pluginManager: {
        run: jest.fn(),
        getPlugins: jest.fn().mockReturnValue([])
      }
    };

    cliOptions = {};

    fs.readFileSync = jest.fn().mockReturnValue('Resources: {}');
    yaml.load = jest.fn().mockReturnValue(JSON.parse(JSON.stringify(mockResources)));

    plugin = new ServerlessFullstackPlugin(serverless, cliOptions);
  });

  describe('prepareResources with all options', () => {
    it('should configure logging', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.Logging).toBeDefined();
      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.Logging.Bucket).toBe('logs.example.com');
    });

    it('should configure domain', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.Aliases).toEqual(['example.com']);
    });

    it('should configure domain as array', () => {
      plugin.serverless.service.custom.fullstack.domain = ['example.com', 'www.example.com'];
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.Aliases).toEqual(['example.com', 'www.example.com']);
    });

    it('should configure price class', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.PriceClass).toBe('PriceClass_100');
    });

    it('should configure API Gateway origin path', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      const apiOrigin = resources.Resources.ApiDistribution.Properties.DistributionConfig.Origins.find(o => o.Id === 'ApiGateway');
      expect(apiOrigin.OriginPath).toBe('/prod');
    });

    it('should add custom origins', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      const customOrigin = resources.Resources.ApiDistribution.Properties.DistributionConfig.Origins.find(
        o => o.Id === 'CustomOrigin'
      );
      expect(customOrigin).toBeDefined();
      expect(customOrigin.DomainName).toBe('custom.example.com');
    });

    it('should configure API path pattern', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      const apiCacheBehavior = resources.Resources.ApiDistribution.Properties.DistributionConfig.CacheBehaviors.find(
        cb => cb.TargetOriginId === 'ApiGateway'
      );
      expect(apiCacheBehavior.PathPattern).toBe('api/v1/*');
    });

    it('should add custom cache behaviors', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      const customBehavior = resources.Resources.ApiDistribution.Properties.DistributionConfig.CacheBehaviors.find(
        cb => cb.PathPattern === '/custom/*'
      );
      expect(customBehavior).toBeDefined();
    });

    it('should configure certificate', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.ViewerCertificate).toBeDefined();
      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.ViewerCertificate.AcmCertificateArn)
        .toBe('arn:aws:acm:us-east-1:123456789:certificate/abc');
    });

    it('should configure minimum protocol version', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.ViewerCertificate.MinimumProtocolVersion)
        .toBe('TLSv1.2_2021');
    });

    it('should configure WAF', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.WebACLId)
        .toBe('arn:aws:wafv2:us-east-1:123456789:global/webacl/test/abc');
    });

    it('should configure single page app', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      const errorResponse = resources.Resources.ApiDistribution.Properties.DistributionConfig.CustomErrorResponses.find(
        er => er.ErrorCode === '403'
      );
      expect(errorResponse.ResponsePagePath).toBe('/index.html');
      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.DefaultRootObject).toBe('index.html');
    });

    it('should configure default cache behavior', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.DefaultCacheBehavior.Compress).toBe(true);
      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.DefaultCacheBehavior.MinTTL).toBe(0);
    });

    it('should configure S3 bucket with custom name', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      expect(resources.Resources.WebAppS3Bucket.Properties.BucketName).toBe('test-service-prod-test-bucket');
    });
  });

  describe('prepareResources without optional configs', () => {
    beforeEach(() => {
      serverless.service.custom.fullstack = {
        bucketName: 'test-bucket',
        singlePageApp: false
      };
      plugin = new ServerlessFullstackPlugin(serverless, cliOptions);
    });

    it('should remove logging when not configured', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.Logging).toBeUndefined();
    });

    it('should remove domain aliases when not configured', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.Aliases).toBeUndefined();
    });

    it('should remove certificate when not configured', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.ViewerCertificate).toBeUndefined();
    });

    it('should remove WAF when not configured', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.WebACLId).toBeUndefined();
    });

    it('should handle non-single page app configuration', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      expect(resources.Resources.ApiDistribution.Properties.DistributionConfig.CustomErrorResponses).toBeUndefined();
      expect(resources.Resources.S3OriginAccessIdentity).toBeUndefined();
    });

    it('should filter out OAIGetObject statement for non-SPA', () => {
      const resources = JSON.parse(JSON.stringify(mockResources));
      plugin.prepareResources(resources);

      const hasOAI = resources.Resources.WebAppS3BucketPolicy.Properties.PolicyDocument.Statement.some(
        s => s.Sid === 'OAIGetObject'
      );
      expect(hasOAI).toBe(false);
    });
  });

  describe('setApiGatewayIdFromConfig', () => {
    it('should set API Gateway ID from config', () => {
      const baseResources = JSON.parse(JSON.stringify(serverless.service.provider.compiledCloudFormationTemplate));
      baseResources.Resources.ApiDistribution = {
        Properties: {
          DistributionConfig: {
            Origins: [
              { Id: 'ApiGateway', DomainName: 'old' }
            ]
          }
        }
      };

      const result = plugin.setApiGatewayIdFromConfig(baseResources);

      expect(result).toBe(true);
      expect(baseResources.Resources.ApiDistribution.Properties.DistributionConfig.Origins[0].DomainName).toBeDefined();
    });

    it('should return false when no REST API ID is configured', () => {
      delete serverless.service.provider.apiGateway;
      plugin = new ServerlessFullstackPlugin(serverless, cliOptions);

      const baseResources = JSON.parse(JSON.stringify(serverless.service.provider.compiledCloudFormationTemplate));
      const result = plugin.setApiGatewayIdFromConfig(baseResources);

      expect(result).toBe(false);
    });
  });

  describe('removeApiGatewayOrigin', () => {
    it('should remove API Gateway origin and cache behaviors', () => {
      const baseResources = {
        Resources: {
          ApiDistribution: {
            Properties: {
              DistributionConfig: {
                Origins: [
                  { Id: 'ApiGateway' },
                  { Id: 'WebApp' }
                ],
                CacheBehaviors: [
                  { TargetOriginId: 'ApiGateway' },
                  { TargetOriginId: 'WebApp' }
                ]
              }
            }
          }
        }
      };

      plugin.removeApiGatewayOrigin(baseResources);

      expect(baseResources.Resources.ApiDistribution.Properties.DistributionConfig.Origins).toHaveLength(1);
      expect(baseResources.Resources.ApiDistribution.Properties.DistributionConfig.CacheBehaviors).toHaveLength(1);
      expect(baseResources.Resources.ApiDistribution.Properties.DistributionConfig.Origins[0].Id).toBe('WebApp');
    });
  });

  describe('getRestApiId', () => {
    it('should get REST API ID from apiGateway section', () => {
      const result = plugin.getRestApiId();
      expect(result).toBe('abc123');
    });

    it('should get REST API ID from custom config', () => {
      delete serverless.service.provider.apiGateway;
      serverless.service.custom.fullstack.apiGatewayRestApiId = 'custom123';
      plugin = new ServerlessFullstackPlugin(serverless, cliOptions);

      const result = plugin.getRestApiId();
      expect(result).toBe('custom123');
    });

    it('should return null when no API Gateway ID is configured', () => {
      delete serverless.service.provider.apiGateway;
      plugin = new ServerlessFullstackPlugin(serverless, cliOptions);

      const result = plugin.getRestApiId();
      expect(result).toBeNull();
    });
  });
});
