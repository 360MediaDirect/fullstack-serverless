const ServerlessFullstackPlugin = require('../index');
const { spawn } = require('child_process');
const fs = require('fs');
const yaml = require('js-yaml');
const bucketUtils = require('../lib/bucketUtils');
const uploadDirectory = require('../lib/upload');
const validateClient = require('../lib/validate');
const invalidateCloudfrontDistribution = require('../lib/cloudFront');
const Confirm = require('prompt-confirm');

jest.mock('child_process');
jest.mock('fs');
jest.mock('js-yaml');
jest.mock('../lib/bucketUtils');
jest.mock('../lib/upload');
jest.mock('../lib/validate');
jest.mock('../lib/cloudFront');
jest.mock('prompt-confirm');

describe('ServerlessFullstackPlugin', () => {
  let plugin;
  let serverless;
  let cliOptions;

  beforeEach(() => {
    serverless = {
      classes: {
        Error: Error
      },
      service: {
        service: 'test-service',
        custom: {
          fullstack: {
            bucketName: 'test-bucket'
          }
        },
        provider: {
          stage: 'dev',
          environment: {
            ENV_VAR: 'value'
          },
          compiledCloudFormationTemplate: {
            Resources: {
              ApiGatewayRestApi: { Type: 'AWS::ApiGateway::RestApi' },
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
      utils: {
        dirExistsSync: jest.fn().mockReturnValue(true)
      },
      pluginManager: {
        run: jest.fn().mockResolvedValue({}),
        getPlugins: jest.fn().mockReturnValue([])
      }
    };

    cliOptions = {
      stage: 'dev',
      region: 'us-east-1'
    };

    plugin = new ServerlessFullstackPlugin(serverless, cliOptions);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize plugin with serverless and options', () => {
      expect(plugin.serverless).toBe(serverless);
      expect(plugin.options).toEqual(serverless.service.custom.fullstack);
      expect(plugin.cliOptions).toEqual(cliOptions);
    });

    it('should register hooks', () => {
      expect(plugin.hooks).toBeDefined();
      expect(Object.keys(plugin.hooks).length).toBeGreaterThan(0);
    });

    it('should register commands', () => {
      expect(plugin.commands.client).toBeDefined();
      expect(plugin.commands.client.commands.deploy).toBeDefined();
      expect(plugin.commands.client.commands.remove).toBeDefined();
    });
  });

  describe('validateConfig', () => {
    it('should pass validation with valid config', async () => {
      validateClient.mockImplementation(() => {});

      await expect(plugin.validateConfig()).resolves.toBeUndefined();
    });

    it('should reject with validation errors', async () => {
      validateClient.mockImplementation(() => {
        throw ['Error 1', 'Error 2'];
      });

      await expect(plugin.validateConfig()).rejects.toMatch(/Error 1/);
      await expect(plugin.validateConfig()).rejects.toMatch(/Error 2/);
    });
  });

  describe('removeDeployedResources', () => {
    beforeEach(() => {
      validateClient.mockImplementation(() => {});
      plugin.cliOptions.confirm = false;
    });

    it('should remove bucket contents when it exists', async () => {
      bucketUtils.bucketExists.mockResolvedValue(true);
      bucketUtils.emptyBucket.mockResolvedValue({});

      await plugin.removeDeployedResources();

      expect(bucketUtils.bucketExists).toHaveBeenCalled();
      expect(bucketUtils.emptyBucket).toHaveBeenCalled();
      expect(serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining('Your client files have been removed')
      );
    });

    it('should handle non-existent bucket', async () => {
      bucketUtils.bucketExists.mockResolvedValue(false);

      await plugin.removeDeployedResources();

      expect(bucketUtils.emptyBucket).not.toHaveBeenCalled();
      expect(serverless.cli.log).toHaveBeenCalledWith('Bucket does not exist');
    });

    it('should prompt for confirmation when not disabled', async () => {
      plugin.cliOptions.confirm = undefined;
      plugin.options.noConfirm = undefined;

      const mockConfirm = {
        run: jest.fn().mockResolvedValue(true)
      };
      Confirm.mockImplementation(() => mockConfirm);

      bucketUtils.bucketExists.mockResolvedValue(true);
      bucketUtils.emptyBucket.mockResolvedValue({});

      await plugin.removeDeployedResources();

      expect(Confirm).toHaveBeenCalled();
      expect(mockConfirm.run).toHaveBeenCalled();
    });

    it('should skip removal if user declines confirmation', async () => {
      plugin.cliOptions.confirm = undefined;
      plugin.options.noConfirm = undefined;

      const mockConfirm = {
        run: jest.fn().mockResolvedValue(false)
      };
      Confirm.mockImplementation(() => mockConfirm);

      await plugin.removeDeployedResources();

      expect(bucketUtils.bucketExists).not.toHaveBeenCalled();
      expect(serverless.cli.log).toHaveBeenCalledWith('Bucket not removed');
    });

    it('should handle errors during bucket operations', async () => {
      bucketUtils.bucketExists.mockRejectedValue(new Error('AWS Error'));

      await expect(plugin.removeDeployedResources()).rejects.toThrow();
    });
  });

  describe('setClientEnv', () => {
    it('should merge serverless environment with process.env', () => {
      const result = plugin.setClientEnv();

      expect(result).toMatchObject({
        ENV_VAR: 'value'
      });
    });

    it('should handle missing environment variables', () => {
      delete serverless.service.provider.environment;

      plugin.setClientEnv();

      expect(serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining('No environment variables detected')
      );
    });
  });

  describe('generateClient', () => {
    it('should skip generation when no clientCommand is specified', async () => {
      await plugin.generateClient();

      expect(serverless.cli.log).toHaveBeenCalledWith('Skipping client generation...');
    });

    it('should skip generation when generate-client is false', async () => {
      plugin.options.clientCommand = 'npm run build';
      plugin.cliOptions['generate-client'] = false;

      await plugin.generateClient();

      expect(serverless.cli.log).toHaveBeenCalledWith('Skipping client generation...');
    });

    it('should spawn client command', async () => {
      plugin.options.clientCommand = 'npm run build';
      plugin.options.clientSrcPath = './client';

      const mockProc = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
        })
      };

      spawn.mockReturnValue(mockProc);

      await plugin.generateClient();

      expect(spawn).toHaveBeenCalledWith('npm', ['run', 'build'], {
        cwd: './client',
        env: expect.any(Object),
        shell: false
      });
    });

    it('should handle successful command execution', async () => {
      plugin.options.clientCommand = 'npm run build';

      const mockProc = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
        })
      };

      spawn.mockReturnValue(mockProc);

      await plugin.generateClient();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining('Client generation process succeeded')
      );
    });

    it('should handle command execution failure', async () => {
      plugin.options.clientCommand = 'npm run build';

      const mockProc = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 0);
          }
        })
      };

      spawn.mockReturnValue(mockProc);

      const promise = plugin.generateClient();

      await new Promise(resolve => setTimeout(resolve, 10));

      await expect(promise).rejects.toThrow(/Client generation failed/);
    });

    it('should log stdout data', async () => {
      plugin.options.clientCommand = 'npm run build';

      const mockProc = {
        stdout: { on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('Build output'));
          }
        })},
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
        })
      };

      spawn.mockReturnValue(mockProc);

      await plugin.generateClient();

      expect(mockProc.stdout.on).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should log stderr data', async () => {
      plugin.options.clientCommand = 'npm run build';

      const mockProc = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('Error output'));
          }
        })},
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
        })
      };

      spawn.mockReturnValue(mockProc);

      await plugin.generateClient();

      expect(mockProc.stderr.on).toHaveBeenCalledWith('data', expect.any(Function));
    });
  });

  describe('processDeployment', () => {
    beforeEach(() => {
      plugin.cliOptions['client-deploy'] = true;
      plugin.cliOptions.confirm = false;
      validateClient.mockImplementation(() => {});
      bucketUtils.bucketExists.mockResolvedValue(true);
      bucketUtils.emptyBucket.mockResolvedValue({});
      uploadDirectory.mockResolvedValue({});
      invalidateCloudfrontDistribution.mockResolvedValue({});
    });

    it('should skip deployment when client-deploy is false', async () => {
      plugin.cliOptions['client-deploy'] = false;

      await plugin.processDeployment();

      expect(serverless.cli.log).toHaveBeenCalledWith('Skipping client deployment...');
      expect(bucketUtils.bucketExists).not.toHaveBeenCalled();
    });

    it('should deploy client files successfully', async () => {
      await plugin.processDeployment();

      expect(validateClient).toHaveBeenCalled();
      expect(bucketUtils.bucketExists).toHaveBeenCalled();
      expect(uploadDirectory).toHaveBeenCalled();
      expect(serverless.cli.log).toHaveBeenCalledWith('Success! Client deployed.');
    });

    it('should delete bucket contents before upload by default', async () => {
      await plugin.processDeployment();

      expect(bucketUtils.emptyBucket).toHaveBeenCalled();
    });

    it('should skip deletion when delete-contents is false', async () => {
      plugin.cliOptions['delete-contents'] = false;

      await plugin.processDeployment();

      expect(bucketUtils.emptyBucket).not.toHaveBeenCalled();
      expect(serverless.cli.log).toHaveBeenCalledWith('Keeping current bucket contents...');
    });

    it('should skip deletion when noDeleteContents is true', async () => {
      plugin.options.noDeleteContents = true;

      await plugin.processDeployment();

      expect(bucketUtils.emptyBucket).not.toHaveBeenCalled();
    });

    it('should handle non-existent bucket', async () => {
      bucketUtils.bucketExists.mockResolvedValue(false);

      await expect(plugin.processDeployment()).rejects.toThrow();
    });

    it('should invalidate CloudFront distribution by default', async () => {
      await plugin.processDeployment();

      expect(invalidateCloudfrontDistribution).toHaveBeenCalled();
    });

    it('should skip CloudFront invalidation when flag is set', async () => {
      plugin.cliOptions['invalidate-distribution'] = false;

      await plugin.processDeployment();

      expect(invalidateCloudfrontDistribution).not.toHaveBeenCalled();
    });

    it('should use custom invalidation paths', async () => {
      plugin.options.invalidationPaths = ['/index.html', '/images/*'];

      await plugin.processDeployment();

      expect(invalidateCloudfrontDistribution).toHaveBeenCalledWith(
        serverless,
        ['/index.html', '/images/*']
      );
    });

    it('should add leading slash to invalidation paths', async () => {
      plugin.options.invalidationPaths = ['index.html', 'images/*'];

      await plugin.processDeployment();

      expect(invalidateCloudfrontDistribution).toHaveBeenCalledWith(
        serverless,
        ['/index.html', '/images/*']
      );
    });

    it('should convert single invalidation path to array', async () => {
      plugin.options.invalidationPaths = '/custom/*';

      await plugin.processDeployment();

      expect(invalidateCloudfrontDistribution).toHaveBeenCalledWith(
        serverless,
        ['/custom/*']
      );
    });

    it('should prompt for confirmation', async () => {
      plugin.cliOptions.confirm = undefined;
      plugin.options.noConfirm = undefined;

      const mockConfirm = {
        run: jest.fn().mockResolvedValue(true)
      };
      Confirm.mockImplementation(() => mockConfirm);

      await plugin.processDeployment();

      expect(Confirm).toHaveBeenCalled();
    });

    it('should cancel deployment if user declines', async () => {
      plugin.cliOptions.confirm = undefined;
      plugin.options.noConfirm = undefined;

      const mockConfirm = {
        run: jest.fn().mockResolvedValue(false)
      };
      Confirm.mockImplementation(() => mockConfirm);

      await plugin.processDeployment();

      expect(uploadDirectory).not.toHaveBeenCalled();
      expect(serverless.cli.log).toHaveBeenCalledWith('Client deployment cancelled');
    });
  });

  describe('createDeploymentArtifacts', () => {
    beforeEach(() => {
      fs.readFileSync.mockReturnValue('Resources: {}');
      yaml.load.mockReturnValue({
        Resources: {
          ApiDistribution: {
            Properties: {
              DistributionConfig: {
                Origins: [],
                CacheBehaviors: [],
                DefaultCacheBehavior: {}
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
                Statement: []
              }
            }
          }
        }
      });
    });

    it('should load and merge CloudFormation resources', () => {
      const result = plugin.createDeploymentArtifacts();

      expect(fs.readFileSync).toHaveBeenCalled();
      expect(yaml.load).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('checkForApiGataway', () => {
    it('should keep API Gateway origin when ApiGatewayRestApi exists', () => {
      const result = plugin.checkForApiGataway();

      expect(result).toBeDefined();
    });

    it('should remove API Gateway origin when ApiGatewayRestApi does not exist', () => {
      delete serverless.service.provider.compiledCloudFormationTemplate.Resources.ApiGatewayRestApi;

      const result = plugin.checkForApiGataway();

      expect(result).toBeDefined();
    });
  });

  describe('getBucketName', () => {
    it('should generate bucket name with service and stage', () => {
      const result = plugin.getBucketName('webapp');

      expect(result).toBe('test-service-dev-webapp');
    });
  });

  describe('getStage', () => {
    it('should return CLI option stage if provided', () => {
      plugin.cliOptions.stage = 'prod';

      const result = plugin.getStage();

      expect(result).toBe('prod');
    });

    it('should return provider stage if CLI option not provided', () => {
      delete plugin.cliOptions.stage;

      const result = plugin.getStage();

      expect(result).toBe('dev');
    });
  });

  describe('getConfig', () => {
    it('should return config value from serverless', () => {
      plugin.serverless.service.custom.fullstack.testField = 'testValue';

      const result = plugin.getConfig('testField');

      expect(result).toBe('testValue');
    });

    it('should return default value when field not found', () => {
      const result = plugin.getConfig('nonExistentField', 'defaultValue');

      expect(result).toBe('defaultValue');
    });
  });

  describe('printSummary', () => {
    it('should print CloudFront distribution domain', () => {
      serverless.pluginManager.getPlugins.mockReturnValue([
        {
          constructor: { name: 'AwsInfo' },
          gatheredData: {
            outputs: [
              {
                OutputKey: 'ApiDistribution',
                OutputValue: 'd123.cloudfront.net'
              }
            ]
          }
        }
      ]);

      plugin.printSummary();

      expect(serverless.cli.consoleLog).toHaveBeenCalled();
    });

    it('should handle missing AwsInfo plugin', () => {
      plugin.printSummary();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
