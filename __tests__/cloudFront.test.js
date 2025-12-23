const invalidateCloudfrontDistribution = require('../lib/cloudFront');

describe('cloudFront', () => {
  let mockServerless;
  let mockAws;

  beforeEach(() => {
    jest.useFakeTimers();

    mockAws = {
      naming: {
        getStackName: jest.fn().mockReturnValue('test-stack')
      },
      request: jest.fn()
    };

    mockServerless = {
      getProvider: jest.fn().mockReturnValue(mockAws),
      cli: {
        log: jest.fn()
      }
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should skip invalidation when distribution id is not found', async () => {
    mockAws.request.mockResolvedValue({
      StackResourceSummaries: []
    });

    await invalidateCloudfrontDistribution(mockServerless, ['/*']);

    expect(mockServerless.cli.log).toHaveBeenCalledWith(
      expect.stringContaining('CloudFront distribution id was not found')
    );
    expect(mockAws.request).toHaveBeenCalledTimes(1);
  });

  it('should create and wait for invalidation to complete', async () => {
    // Mock listStackResources
    mockAws.request.mockResolvedValueOnce({
      StackResourceSummaries: [
        {
          LogicalResourceId: 'ApiDistribution',
          PhysicalResourceId: 'DISTRIBUTION123'
        }
      ]
    });

    // Mock createInvalidation
    mockAws.request.mockResolvedValueOnce({
      Invalidation: {
        Id: 'INVALIDATION123'
      }
    });

    // Mock getInvalidation - first call returns InProgress, second returns Completed
    mockAws.request
      .mockResolvedValueOnce({
        Invalidation: { Status: 'InProgress' }
      })
      .mockResolvedValueOnce({
        Invalidation: { Status: 'Completed' }
      });

    const promise = invalidateCloudfrontDistribution(mockServerless, ['/*', '/images/*']);

    // Fast-forward through setTimeout calls
    await jest.runAllTimersAsync();

    await promise;

    expect(mockAws.request).toHaveBeenCalledWith('CloudFormation', 'listStackResources', {
      StackName: 'test-stack'
    });

    expect(mockAws.request).toHaveBeenCalledWith('CloudFront', 'createInvalidation', {
      DistributionId: 'DISTRIBUTION123',
      InvalidationBatch: {
        CallerReference: expect.any(String),
        Paths: {
          Quantity: 2,
          Items: ['/*', '/images/*']
        }
      }
    });

    expect(mockServerless.cli.log).toHaveBeenCalledWith('CloudFront invalidation started...');
    expect(mockServerless.cli.log).toHaveBeenCalledWith('CloudFront invalidation completed.');
  });

  it('should poll invalidation status until completed', async () => {
    // Mock listStackResources
    mockAws.request.mockResolvedValueOnce({
      StackResourceSummaries: [
        {
          LogicalResourceId: 'ApiDistribution',
          PhysicalResourceId: 'DISTRIBUTION123'
        }
      ]
    });

    // Mock createInvalidation
    mockAws.request.mockResolvedValueOnce({
      Invalidation: { Id: 'INVALIDATION123' }
    });

    // Mock getInvalidation - multiple InProgress calls before Completed
    mockAws.request
      .mockResolvedValueOnce({ Invalidation: { Status: 'InProgress' } })
      .mockResolvedValueOnce({ Invalidation: { Status: 'InProgress' } })
      .mockResolvedValueOnce({ Invalidation: { Status: 'InProgress' } })
      .mockResolvedValueOnce({ Invalidation: { Status: 'Completed' } });

    const promise = invalidateCloudfrontDistribution(mockServerless, ['/*']);

    // Fast-forward through all setTimeout calls
    await jest.runAllTimersAsync();

    await promise;

    // Should have called getInvalidation multiple times
    const getInvalidationCalls = mockAws.request.mock.calls.filter(
      call => call[0] === 'CloudFront' && call[1] === 'getInvalidation'
    );
    expect(getInvalidationCalls.length).toBeGreaterThan(1);
  });

  it('should handle single invalidation path', async () => {
    mockAws.request.mockResolvedValueOnce({
      StackResourceSummaries: [
        {
          LogicalResourceId: 'ApiDistribution',
          PhysicalResourceId: 'DIST123'
        }
      ]
    });

    mockAws.request.mockResolvedValueOnce({
      Invalidation: { Id: 'INV123' }
    });

    mockAws.request.mockResolvedValueOnce({
      Invalidation: { Status: 'Completed' }
    });

    const promise = invalidateCloudfrontDistribution(mockServerless, ['/index.html']);

    await jest.runAllTimersAsync();
    await promise;

    expect(mockAws.request).toHaveBeenCalledWith('CloudFront', 'createInvalidation',
      expect.objectContaining({
        InvalidationBatch: expect.objectContaining({
          Paths: {
            Quantity: 1,
            Items: ['/index.html']
          }
        })
      })
    );
  });

  it('should find ApiDistribution among multiple resources', async () => {
    mockAws.request.mockResolvedValueOnce({
      StackResourceSummaries: [
        { LogicalResourceId: 'OtherResource', PhysicalResourceId: 'OTHER123' },
        { LogicalResourceId: 'ApiDistribution', PhysicalResourceId: 'DIST123' },
        { LogicalResourceId: 'AnotherResource', PhysicalResourceId: 'ANOTHER123' }
      ]
    });

    mockAws.request.mockResolvedValueOnce({
      Invalidation: { Id: 'INV123' }
    });

    mockAws.request.mockResolvedValueOnce({
      Invalidation: { Status: 'Completed' }
    });

    const promise = invalidateCloudfrontDistribution(mockServerless, ['/*']);

    await jest.runAllTimersAsync();
    await promise;

    expect(mockAws.request).toHaveBeenCalledWith('CloudFront', 'createInvalidation',
      expect.objectContaining({
        DistributionId: 'DIST123'
      })
    );
  });

  it('should use unique CallerReference for each invalidation', async () => {
    mockAws.request.mockResolvedValueOnce({
      StackResourceSummaries: [
        { LogicalResourceId: 'ApiDistribution', PhysicalResourceId: 'DIST123' }
      ]
    });

    const mockNow = 1234567890;
    jest.spyOn(Date, 'now').mockReturnValue(mockNow);

    mockAws.request.mockResolvedValueOnce({
      Invalidation: { Id: 'INV123' }
    });

    mockAws.request.mockResolvedValueOnce({
      Invalidation: { Status: 'Completed' }
    });

    const promise = invalidateCloudfrontDistribution(mockServerless, ['/*']);

    await jest.runAllTimersAsync();
    await promise;

    expect(mockAws.request).toHaveBeenCalledWith('CloudFront', 'createInvalidation',
      expect.objectContaining({
        InvalidationBatch: expect.objectContaining({
          CallerReference: mockNow.toString()
        })
      })
    );
  });

  it('should handle AWS errors during invalidation', async () => {
    mockAws.request.mockRejectedValue(new Error('AWS API Error'));

    await expect(invalidateCloudfrontDistribution(mockServerless, ['/*']))
      .rejects
      .toThrow('AWS API Error');
  });

  it('should handle errors during status checking', async () => {
    mockAws.request.mockResolvedValueOnce({
      StackResourceSummaries: [
        { LogicalResourceId: 'ApiDistribution', PhysicalResourceId: 'DIST123' }
      ]
    });

    mockAws.request.mockResolvedValueOnce({
      Invalidation: { Id: 'INV123' }
    });

    mockAws.request.mockRejectedValueOnce(new Error('Status check failed'));

    await expect(async () => {
      const promise = invalidateCloudfrontDistribution(mockServerless, ['/*']);
      await jest.runAllTimersAsync();
      await promise;
    }).rejects.toThrow('Status check failed');
  }, 10000);
});
