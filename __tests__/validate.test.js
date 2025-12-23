const validateClient = require('../lib/validate');

describe('validateClient', () => {
  let mockServerless;
  let options;

  beforeEach(() => {
    mockServerless = {
      config: {
        servicePath: '/test/project'
      },
      utils: {
        dirExistsSync: jest.fn().mockReturnValue(true)
      }
    };

    options = {
      bucketName: 'test-bucket'
    };
  });

  describe('distributionFolder validation', () => {
    it('should pass when distribution folder exists', () => {
      expect(() => validateClient(mockServerless, options)).not.toThrow();
    });

    it('should fail when distribution folder does not exist', () => {
      mockServerless.utils.dirExistsSync.mockReturnValue(false);

      expect(() => validateClient(mockServerless, options))
        .toThrow(/Could not find.*folder in your project root/);
    });

    it('should use custom distributionFolder if provided', () => {
      options.distributionFolder = 'custom/dist';

      validateClient(mockServerless, options);

      expect(mockServerless.utils.dirExistsSync)
        .toHaveBeenCalledWith(expect.stringContaining('custom/dist'));
    });
  });

  describe('bucketName validation', () => {
    it('should pass with valid string bucket name', () => {
      expect(() => validateClient(mockServerless, options)).not.toThrow();
    });

    it('should fail when bucketName is not a string', () => {
      options.bucketName = 123;

      expect(() => validateClient(mockServerless, options))
        .toThrow(/Please specify a bucket name/);
    });

    it('should fail when bucketName is undefined', () => {
      delete options.bucketName;

      expect(() => validateClient(mockServerless, options))
        .toThrow(/Please specify a bucket name/);
    });

    it('should fail when bucketName is null', () => {
      options.bucketName = null;

      expect(() => validateClient(mockServerless, options))
        .toThrow(/Please specify a bucket name/);
    });
  });

  describe('objectHeaders validation', () => {
    it('should pass with valid objectHeaders structure', () => {
      options.objectHeaders = {
        'ALL_OBJECTS': [
          { name: 'Cache-Control', value: 'max-age=3600' }
        ],
        'static/': [
          { name: 'Cache-Control', value: 'max-age=86400' }
        ]
      };

      expect(() => validateClient(mockServerless, options)).not.toThrow();
    });

    it('should fail when objectHeaders is not an object', () => {
      options.objectHeaders = 'invalid';

      expect(() => validateClient(mockServerless, options))
        .toThrow();
    });

    it('should fail when objectHeaders member is not an array', () => {
      options.objectHeaders = {
        'ALL_OBJECTS': 'not-an-array'
      };

      expect(() => validateClient(mockServerless, options))
        .toThrow();
    });

    it('should fail when header is missing name attribute', () => {
      options.objectHeaders = {
        'ALL_OBJECTS': [
          { value: 'max-age=3600' }
        ]
      };

      expect(() => validateClient(mockServerless, options))
        .toThrow(/Each object header must have a \(string\) 'name' attribute/);
    });

    it('should fail when header name is not a string', () => {
      options.objectHeaders = {
        'ALL_OBJECTS': [
          { name: 123, value: 'max-age=3600' }
        ]
      };

      expect(() => validateClient(mockServerless, options))
        .toThrow(/Each object header must have a \(string\) 'name' attribute/);
    });

    it('should fail when header is missing value attribute', () => {
      options.objectHeaders = {
        'ALL_OBJECTS': [
          { name: 'Cache-Control' }
        ]
      };

      expect(() => validateClient(mockServerless, options))
        .toThrow(/Each object header must have a \(string\) 'value' attribute/);
    });

    it('should fail when header value is not a string', () => {
      options.objectHeaders = {
        'ALL_OBJECTS': [
          { name: 'Cache-Control', value: 3600 }
        ]
      };

      expect(() => validateClient(mockServerless, options))
        .toThrow(/Each object header must have a \(string\) 'value' attribute/);
    });
  });

  describe('redirectAllRequestsTo validation', () => {
    it('should pass with valid redirectAllRequestsTo', () => {
      options.redirectAllRequestsTo = {
        hostName: 'example.com'
      };

      expect(() => validateClient(mockServerless, options)).not.toThrow();
    });

    it('should fail when redirectAllRequestsTo is used with indexDocument', () => {
      options.redirectAllRequestsTo = { hostName: 'example.com' };
      options.indexDocument = 'index.html';

      expect(() => validateClient(mockServerless, options))
        .toThrow(/indexDocument cannot be specified with redirectAllRequestsTo/);
    });

    it('should fail when redirectAllRequestsTo is used with errorDocument', () => {
      options.redirectAllRequestsTo = { hostName: 'example.com' };
      options.errorDocument = 'error.html';

      expect(() => validateClient(mockServerless, options))
        .toThrow(/errorDocument cannot be specified with redirectAllRequestsTo/);
    });

    it('should fail when redirectAllRequestsTo is used with routingRules', () => {
      options.redirectAllRequestsTo = { hostName: 'example.com' };
      options.routingRules = [];

      expect(() => validateClient(mockServerless, options))
        .toThrow(/routingRules cannot be specified with redirectAllRequestsTo/);
    });

    it('should fail when redirectAllRequestsTo is missing hostName', () => {
      options.redirectAllRequestsTo = {};

      expect(() => validateClient(mockServerless, options))
        .toThrow(/redirectAllRequestsTo.hostName is required/);
    });

    it('should fail when redirectAllRequestsTo hostName is not a string', () => {
      options.redirectAllRequestsTo = { hostName: 123 };

      expect(() => validateClient(mockServerless, options))
        .toThrow(/redirectAllRequestsTo.hostName must be a string/);
    });

    it('should pass with valid protocol', () => {
      options.redirectAllRequestsTo = {
        hostName: 'example.com',
        protocol: 'https'
      };

      expect(() => validateClient(mockServerless, options)).not.toThrow();
    });

    it('should fail when protocol is not a string', () => {
      options.redirectAllRequestsTo = {
        hostName: 'example.com',
        protocol: 443
      };

      expect(() => validateClient(mockServerless, options))
        .toThrow();
    });

    it('should fail when protocol is not http or https', () => {
      options.redirectAllRequestsTo = {
        hostName: 'example.com',
        protocol: 'ftp'
      };

      expect(() => validateClient(mockServerless, options))
        .toThrow(/redirectAllRequestsTo.protocol must be either http or https/);
    });
  });

  describe('routingRules validation', () => {
    it('should pass with valid routingRules', () => {
      options.routingRules = [
        {
          redirect: {
            hostName: 'example.com',
            httpRedirectCode: 301
          }
        }
      ];

      expect(() => validateClient(mockServerless, options)).not.toThrow();
    });

    it('should fail when routingRules is not an array', () => {
      options.routingRules = { rule: 'invalid' };

      expect(() => validateClient(mockServerless, options))
        .toThrow();
    });

    it('should fail when routing rule is missing redirect', () => {
      options.routingRules = [{}];

      expect(() => validateClient(mockServerless, options))
        .toThrow();
    });

    it('should fail when both replaceKeyPrefixWith and replaceKeyWith are specified', () => {
      options.routingRules = [
        {
          redirect: {
            replaceKeyPrefixWith: 'prefix/',
            replaceKeyWith: 'key.html'
          }
        }
      ];

      expect(() => validateClient(mockServerless, options))
        .toThrow(/replaceKeyPrefixWith and replaceKeyWith cannot both be specified/);
    });

    it('should fail when httpRedirectCode is not an integer', () => {
      options.routingRules = [
        {
          redirect: {
            httpRedirectCode: '301'
          }
        }
      ];

      expect(() => validateClient(mockServerless, options))
        .toThrow(/redirect.httpRedirectCode must be an integer/);
    });

    it('should fail when redirect properties are not strings', () => {
      options.routingRules = [
        {
          redirect: {
            hostName: 123
          }
        }
      ];

      expect(() => validateClient(mockServerless, options))
        .toThrow(/redirect.hostName must be a string/);
    });

    it('should fail when condition is missing required properties', () => {
      options.routingRules = [
        {
          redirect: { hostName: 'example.com' },
          condition: {}
        }
      ];

      expect(() => validateClient(mockServerless, options))
        .toThrow(/condition.httpErrorCodeReturnedEquals or condition.keyPrefixEquals must be defined/);
    });

    it('should pass with valid httpErrorCodeReturnedEquals', () => {
      options.routingRules = [
        {
          redirect: { hostName: 'example.com' },
          condition: { httpErrorCodeReturnedEquals: 404 }
        }
      ];

      expect(() => validateClient(mockServerless, options)).not.toThrow();
    });

    it('should pass with valid keyPrefixEquals', () => {
      options.routingRules = [
        {
          redirect: { hostName: 'example.com' },
          condition: { keyPrefixEquals: 'docs/' }
        }
      ];

      expect(() => validateClient(mockServerless, options)).not.toThrow();
    });

    it('should fail when httpErrorCodeReturnedEquals is not an integer', () => {
      options.routingRules = [
        {
          redirect: { hostName: 'example.com' },
          condition: { httpErrorCodeReturnedEquals: '404' }
        }
      ];

      expect(() => validateClient(mockServerless, options))
        .toThrow(/httpErrorCodeReturnedEquals must be an integer/);
    });

    it('should fail when keyPrefixEquals is not a string', () => {
      options.routingRules = [
        {
          redirect: { hostName: 'example.com' },
          condition: { keyPrefixEquals: 404 }
        }
      ];

      expect(() => validateClient(mockServerless, options))
        .toThrow(/keyPrefixEquals must be a string/);
    });
  });

  describe('multiple validation errors', () => {
    it('should throw all validation errors at once', () => {
      mockServerless.utils.dirExistsSync.mockReturnValue(false);
      options.bucketName = null;

      try {
        validateClient(mockServerless, options);
        fail('Should have thrown error');
      } catch (error) {
        expect(Array.isArray(error)).toBe(true);
        expect(error.length).toBeGreaterThan(1);
        expect(error.some(e => e.includes('Could not find'))).toBe(true);
        expect(error.some(e => e.includes('bucket name'))).toBe(true);
      }
    });
  });
});
