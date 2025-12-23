const fs = require('fs');
const path = require('path');
const uploadDirectory = require('../lib/upload');
const getFileList = require('../lib/utilities/getFileList');

jest.mock('fs');
jest.mock('../lib/utilities/getFileList');

describe('upload', () => {
  let mockAws;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAws = {
      request: jest.fn().mockResolvedValue({})
    };

    fs.readFileSync = jest.fn().mockReturnValue(Buffer.from('file content'));
  });

  describe('uploadDirectory', () => {
    it('should upload all files from directory', async () => {
      getFileList.mockReturnValue([
        '/client/dist/index.html',
        '/client/dist/app.js',
        '/client/dist/style.css'
      ]);

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist', null);

      expect(mockAws.request).toHaveBeenCalledTimes(3);
      expect(mockAws.request).toHaveBeenCalledWith('S3', 'putObject',
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'index.html',
          ContentType: expect.stringContaining('html')
        })
      );
    });

    it('should set correct MIME types', async () => {
      getFileList.mockReturnValue([
        '/client/dist/index.html',
        '/client/dist/app.js',
        '/client/dist/style.css',
        '/client/dist/image.png'
      ]);

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist', null);

      const calls = mockAws.request.mock.calls;
      expect(calls[0][2].ContentType).toMatch(/html/);
      expect(calls[1][2].ContentType).toMatch(/javascript/);
      expect(calls[2][2].ContentType).toMatch(/css/);
      expect(calls[3][2].ContentType).toMatch(/png/);
    });

    it('should read file contents', async () => {
      getFileList.mockReturnValue(['/client/dist/index.html']);

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist', null);

      expect(fs.readFileSync).toHaveBeenCalledWith('/client/dist/index.html');
    });

    it('should handle nested directory structures', async () => {
      getFileList.mockReturnValue([
        '/client/dist/index.html',
        '/client/dist/js/app.js',
        '/client/dist/css/style.css',
        '/client/dist/images/logo.png'
      ]);

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist', null);

      const calls = mockAws.request.mock.calls;
      expect(calls[0][2].Key).toBe('index.html');
      expect(calls[1][2].Key).toBe('js/app.js');
      expect(calls[2][2].Key).toBe('css/style.css');
      expect(calls[3][2].Key).toBe('images/logo.png');
    });

    it('should apply ALL_OBJECTS headers to all files', async () => {
      getFileList.mockReturnValue([
        '/client/dist/file1.html',
        '/client/dist/file2.html'
      ]);

      const headerSpec = {
        'ALL_OBJECTS': [
          { name: 'Cache-Control', value: 'max-age=3600' },
          { name: 'X-Custom-Header', value: 'custom-value' }
        ]
      };

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist', headerSpec);

      mockAws.request.mock.calls.forEach(call => {
        expect(call[2].CacheControl).toBe('max-age=3600');
        expect(call[2].Metadata['X-Custom-Header']).toBe('custom-value');
      });
    });

    it('should apply folder-specific headers', async () => {
      const sep = path.sep;
      getFileList.mockReturnValue([
        `/client/dist/index.html`,
        `/client/dist/static${sep}app.js`,
        `/client/dist/static${sep}style.css`
      ]);

      const headerSpec = {
        [`static${sep}`]: [
          { name: 'Cache-Control', value: 'max-age=86400' }
        ]
      };

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist', headerSpec);

      const indexCall = mockAws.request.mock.calls[0][2];
      const jsCall = mockAws.request.mock.calls[1][2];
      const cssCall = mockAws.request.mock.calls[2][2];

      expect(indexCall.CacheControl).toBeUndefined();
      expect(jsCall.CacheControl).toBe('max-age=86400');
      expect(cssCall.CacheControl).toBe('max-age=86400');
    });

    it('should apply file-specific headers', async () => {
      getFileList.mockReturnValue([
        '/client/dist/index.html',
        '/client/dist/app.js'
      ]);

      const headerSpec = {
        'index.html': [
          { name: 'Cache-Control', value: 'no-cache' }
        ]
      };

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist', headerSpec);

      const indexCall = mockAws.request.mock.calls[0][2];
      const jsCall = mockAws.request.mock.calls[1][2];

      expect(indexCall.CacheControl).toBe('no-cache');
      expect(jsCall.CacheControl).toBeUndefined();
    });

    it('should prioritize file-specific over folder-specific headers', async () => {
      const sep = path.sep;
      getFileList.mockReturnValue([
        `/client/dist/static${sep}app.js`,
        `/client/dist/static${sep}special.js`
      ]);

      const headerSpec = {
        [`static${sep}`]: [
          { name: 'Cache-Control', value: 'max-age=86400' }
        ],
        [`static${sep}special.js`]: [
          { name: 'Cache-Control', value: 'no-cache' }
        ]
      };

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist', headerSpec);

      const appCall = mockAws.request.mock.calls[0][2];
      const specialCall = mockAws.request.mock.calls[1][2];

      expect(appCall.CacheControl).toBe('max-age=86400');
      expect(specialCall.CacheControl).toBe('no-cache');
    });

    it('should handle standard S3 headers', async () => {
      getFileList.mockReturnValue(['/client/dist/file.html']);

      const headerSpec = {
        'ALL_OBJECTS': [
          { name: 'Cache-Control', value: 'max-age=3600' },
          { name: 'Content-Encoding', value: 'gzip' },
          { name: 'Content-Language', value: 'en' },
          { name: 'Content-Disposition', value: 'inline' },
          { name: 'Expires', value: 'Wed, 21 Oct 2025 07:28:00 GMT' }
        ]
      };

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist', headerSpec);

      const call = mockAws.request.mock.calls[0][2];
      expect(call.CacheControl).toBe('max-age=3600');
      expect(call.ContentEncoding).toBe('gzip');
      expect(call.ContentLanguage).toBe('en');
      expect(call.ContentDisposition).toBe('inline');
      expect(call.Expires).toBe('Wed, 21 Oct 2025 07:28:00 GMT');
    });

    it('should handle custom metadata headers', async () => {
      getFileList.mockReturnValue(['/client/dist/file.html']);

      const headerSpec = {
        'ALL_OBJECTS': [
          { name: 'X-Custom-Header', value: 'custom-value' },
          { name: 'X-Version', value: '1.0.0' }
        ]
      };

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist', headerSpec);

      const call = mockAws.request.mock.calls[0][2];
      expect(call.Metadata['X-Custom-Header']).toBe('custom-value');
      expect(call.Metadata['X-Version']).toBe('1.0.0');
    });

    it('should handle paths with backslashes on Windows', async () => {
      const originalSep = path.sep;
      Object.defineProperty(path, 'sep', { value: '\\', writable: true });

      getFileList.mockReturnValue([
        'C:\\client\\dist\\index.html',
        'C:\\client\\dist\\js\\app.js'
      ]);

      await uploadDirectory(mockAws, 'test-bucket', 'C:\\client\\dist', null);

      const calls = mockAws.request.mock.calls;
      expect(calls[0][2].Key).toBe('index.html');
      expect(calls[1][2].Key).toBe('js/app.js');

      Object.defineProperty(path, 'sep', { value: originalSep, writable: true });
    });

    it('should handle empty directory', async () => {
      getFileList.mockReturnValue([]);

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist', null);

      expect(mockAws.request).not.toHaveBeenCalled();
    });

    it('should handle upload errors gracefully', async () => {
      getFileList.mockReturnValue(['/client/dist/file.html']);
      mockAws.request.mockRejectedValue(new Error('Upload failed'));

      await expect(uploadDirectory(mockAws, 'test-bucket', '/client/dist', null))
        .rejects
        .toThrow('Upload failed');
    });

    it('should handle multiple concurrent uploads', async () => {
      getFileList.mockReturnValue([
        '/client/dist/file1.html',
        '/client/dist/file2.html',
        '/client/dist/file3.html',
        '/client/dist/file4.html',
        '/client/dist/file5.html'
      ]);

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist', null);

      expect(mockAws.request).toHaveBeenCalledTimes(5);
    });

    it('should normalize client root path with trailing separator', async () => {
      getFileList.mockReturnValue(['/client/dist/index.html']);

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist/', null);

      const call = mockAws.request.mock.calls[0][2];
      expect(call.Key).toBe('index.html');
    });

    it('should handle Website-Redirect-Location header', async () => {
      getFileList.mockReturnValue(['/client/dist/old-page.html']);

      const headerSpec = {
        'old-page.html': [
          { name: 'Website-Redirect-Location', value: '/new-page.html' }
        ]
      };

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist', headerSpec);

      const call = mockAws.request.mock.calls[0][2];
      expect(call.WebsiteRedirectLocation).toBe('/new-page.html');
    });

    it('should set Body parameter with file buffer', async () => {
      const testBuffer = Buffer.from('test content');
      fs.readFileSync.mockReturnValue(testBuffer);
      getFileList.mockReturnValue(['/client/dist/file.txt']);

      await uploadDirectory(mockAws, 'test-bucket', '/client/dist', null);

      const call = mockAws.request.mock.calls[0][2];
      expect(call.Body).toEqual(testBuffer);
    });
  });
});
