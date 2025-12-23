const fs = require('fs');
const path = require('path');
const getFileList = require('../lib/utilities/getFileList');

jest.mock('fs');

describe('getFileList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty array for empty directory', () => {
    fs.readdirSync = jest.fn().mockReturnValue([]);
    const result = getFileList('/test/dir');
    expect(result).toEqual([]);
  });

  it('should return files in a flat directory', () => {
    fs.readdirSync = jest.fn().mockReturnValue(['file1.js', 'file2.js']);
    fs.statSync = jest.fn().mockReturnValue({ isDirectory: () => false });

    const result = getFileList('/test/dir');

    expect(result).toHaveLength(2);
    expect(result).toContain(path.join('/test/dir', 'file1.js'));
    expect(result).toContain(path.join('/test/dir', 'file2.js'));
  });

  it('should recursively scan subdirectories', () => {
    let callCount = 0;
    fs.readdirSync = jest.fn((dir) => {
      if (callCount === 0) {
        callCount++;
        return ['subdir', 'file1.js'];
      } else {
        return ['file2.js'];
      }
    });

    fs.statSync = jest.fn((filePath) => {
      const isDir = filePath.includes('subdir') && !filePath.includes('file2.js');
      return { isDirectory: () => isDir };
    });

    const result = getFileList('/test/dir');

    expect(result).toHaveLength(2);
    expect(fs.readdirSync).toHaveBeenCalledTimes(2);
  });

  it('should handle nested directory structures', () => {
    const mockStructure = {
      '/test/dir': ['dir1', 'file1.txt'],
      '/test/dir/dir1': ['dir2', 'file2.txt'],
      '/test/dir/dir1/dir2': ['file3.txt']
    };

    fs.readdirSync = jest.fn((dir) => mockStructure[path.normalize(dir)] || []);
    fs.statSync = jest.fn((filePath) => ({
      isDirectory: () => !filePath.includes('.txt')
    }));

    const result = getFileList('/test/dir');

    expect(result.length).toBeGreaterThan(0);
    expect(fs.readdirSync).toHaveBeenCalled();
  });

  it('should handle mixed files and directories', () => {
    fs.readdirSync = jest.fn()
      .mockReturnValueOnce(['file1.js', 'dir1', 'file2.css'])
      .mockReturnValueOnce(['file3.html']);

    fs.statSync = jest.fn((filePath) => ({
      isDirectory: () => filePath.includes('dir1') && !filePath.includes('file')
    }));

    const result = getFileList('/test/dir');

    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('should normalize paths correctly', () => {
    fs.readdirSync = jest.fn().mockReturnValue(['file.js']);
    fs.statSync = jest.fn().mockReturnValue({ isDirectory: () => false });

    const result = getFileList('/test/dir');

    expect(result[0]).toBe(path.join('/test/dir', 'file.js'));
  });

  it('should handle fileList parameter on recursive calls', () => {
    fs.readdirSync = jest.fn().mockReturnValue(['file.js']);
    fs.statSync = jest.fn().mockReturnValue({ isDirectory: () => false });

    const existingList = ['/existing/file.js'];
    const result = getFileList('/test/dir', existingList);

    expect(result.length).toBeGreaterThanOrEqual(existingList.length);
    expect(result).toContain('/existing/file.js');
    expect(result.some(f => f.includes('file.js'))).toBe(true);
  });
});
