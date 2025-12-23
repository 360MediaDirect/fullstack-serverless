const fs = require('fs');
const path = require('path');

function getFileList(dir, fileList) {
  fileList = fileList || [];

  // Normalize and resolve the base directory to prevent path traversal
  const normalizedDir = path.resolve(path.normalize(dir));

  let members = fs.readdirSync(normalizedDir);
  members.forEach(member => {
    const memberPath = path.join(normalizedDir, member);

    // Ensure the member path is within the base directory (path traversal protection)
    const resolvedMemberPath = path.resolve(memberPath);
    if (!resolvedMemberPath.startsWith(normalizedDir)) {
      throw new Error(`Path traversal detected: ${member}`);
    }

    if (fs.statSync(resolvedMemberPath).isDirectory()) {
      fileList = getFileList(resolvedMemberPath, fileList);
    } else {
      fileList.push(resolvedMemberPath);
    }
  });
  return fileList;
}

module.exports = getFileList;
