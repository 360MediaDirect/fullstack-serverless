const bucketUtils = require('../lib/bucketUtils');

describe('bucketUtils', () => {
  let mockAws;

  beforeEach(() => {
    mockAws = {
      request: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('bucketExists', () => {
    it('should return true when bucket exists', async () => {
      mockAws.request.mockResolvedValue({
        Buckets: [
          { Name: 'test-bucket' },
          { Name: 'other-bucket' }
        ]
      });

      const result = await bucketUtils.bucketExists(mockAws, 'test-bucket');

      expect(result).toBe(true);
      expect(mockAws.request).toHaveBeenCalledWith('S3', 'listBuckets', {});
    });

    it('should return false when bucket does not exist', async () => {
      mockAws.request.mockResolvedValue({
        Buckets: [
          { Name: 'other-bucket' },
          { Name: 'another-bucket' }
        ]
      });

      const result = await bucketUtils.bucketExists(mockAws, 'test-bucket');

      expect(result).toBe(false);
    });

    it('should return false when no buckets exist', async () => {
      mockAws.request.mockResolvedValue({ Buckets: [] });

      const result = await bucketUtils.bucketExists(mockAws, 'test-bucket');

      expect(result).toBe(false);
    });

    it('should handle AWS request errors', async () => {
      mockAws.request.mockRejectedValue(new Error('AWS Error'));

      await expect(bucketUtils.bucketExists(mockAws, 'test-bucket'))
        .rejects
        .toThrow('AWS Error');
    });
  });

  describe('listObjectsInBucket', () => {
    it('should list objects in bucket', async () => {
      const mockContents = [
        { Key: 'file1.js' },
        { Key: 'file2.css' }
      ];
      mockAws.request.mockResolvedValue({ Contents: mockContents });

      const result = await bucketUtils.listObjectsInBucket(mockAws, 'test-bucket');

      expect(result.Contents).toEqual(mockContents);
      expect(mockAws.request).toHaveBeenCalledWith('S3', 'listObjectsV2', {
        Bucket: 'test-bucket'
      });
    });

    it('should return empty contents for empty bucket', async () => {
      mockAws.request.mockResolvedValue({ Contents: [] });

      const result = await bucketUtils.listObjectsInBucket(mockAws, 'test-bucket');

      expect(result.Contents).toEqual([]);
    });

    it('should handle AWS request errors', async () => {
      mockAws.request.mockRejectedValue(new Error('Bucket not found'));

      await expect(bucketUtils.listObjectsInBucket(mockAws, 'test-bucket'))
        .rejects
        .toThrow('Bucket not found');
    });
  });

  describe('deleteBucket', () => {
    it('should delete bucket successfully', async () => {
      mockAws.request.mockResolvedValue({});

      await bucketUtils.deleteBucket(mockAws, 'test-bucket');

      expect(mockAws.request).toHaveBeenCalledWith('S3', 'deleteBucket', {
        Bucket: 'test-bucket'
      });
    });

    it('should handle deletion errors', async () => {
      mockAws.request.mockRejectedValue(new Error('Bucket not empty'));

      await expect(bucketUtils.deleteBucket(mockAws, 'test-bucket'))
        .rejects
        .toThrow('Bucket not empty');
    });
  });

  describe('emptyBucket', () => {
    it('should delete all objects from bucket', async () => {
      const mockContents = [
        { Key: 'file1.js', Size: 100 },
        { Key: 'file2.css', Size: 200 }
      ];
      mockAws.request
        .mockResolvedValueOnce({ Contents: mockContents })
        .mockResolvedValueOnce({ Deleted: mockContents.map(c => ({ Key: c.Key })) });

      await bucketUtils.emptyBucket(mockAws, 'test-bucket');

      expect(mockAws.request).toHaveBeenCalledTimes(2);
      expect(mockAws.request).toHaveBeenNthCalledWith(1, 'S3', 'listObjectsV2', {
        Bucket: 'test-bucket'
      });
      expect(mockAws.request).toHaveBeenNthCalledWith(2, 'S3', 'deleteObjects', {
        Bucket: 'test-bucket',
        Delete: {
          Objects: [
            { Key: 'file1.js' },
            { Key: 'file2.css' }
          ]
        }
      });
    });

    it('should handle empty bucket gracefully', async () => {
      mockAws.request.mockResolvedValueOnce({ Contents: [] });

      await bucketUtils.emptyBucket(mockAws, 'test-bucket');

      expect(mockAws.request).toHaveBeenCalledTimes(1);
      expect(mockAws.request).toHaveBeenCalledWith('S3', 'listObjectsV2', {
        Bucket: 'test-bucket'
      });
    });

    it('should handle bucket with single file', async () => {
      const mockContents = [{ Key: 'file1.js', Size: 100 }];
      mockAws.request
        .mockResolvedValueOnce({ Contents: mockContents })
        .mockResolvedValueOnce({ Deleted: [{ Key: 'file1.js' }] });

      await bucketUtils.emptyBucket(mockAws, 'test-bucket');

      expect(mockAws.request).toHaveBeenCalledTimes(2);
    });

    it('should handle deletion errors', async () => {
      mockAws.request
        .mockResolvedValueOnce({ Contents: [{ Key: 'file1.js' }] })
        .mockRejectedValueOnce(new Error('Delete failed'));

      await expect(bucketUtils.emptyBucket(mockAws, 'test-bucket'))
        .rejects
        .toThrow('Delete failed');
    });
  });

  describe('createBucket', () => {
    it('should create bucket successfully', async () => {
      mockAws.request.mockResolvedValue({ Location: '/test-bucket' });

      await bucketUtils.createBucket(mockAws, 'test-bucket');

      expect(mockAws.request).toHaveBeenCalledWith('S3', 'createBucket', {
        Bucket: 'test-bucket'
      });
    });

    it('should handle bucket already exists error', async () => {
      mockAws.request.mockRejectedValue(new Error('BucketAlreadyExists'));

      await expect(bucketUtils.createBucket(mockAws, 'test-bucket'))
        .rejects
        .toThrow('BucketAlreadyExists');
    });

    it('should handle creation errors', async () => {
      mockAws.request.mockRejectedValue(new Error('Invalid bucket name'));

      await expect(bucketUtils.createBucket(mockAws, 'invalid-bucket-name!'))
        .rejects
        .toThrow('Invalid bucket name');
    });
  });
});
