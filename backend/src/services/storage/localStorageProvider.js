const fs = require('fs/promises');
const path = require('path');

const STORAGE_ROOT = process.env.STORAGE_ROOT
  ? path.resolve(process.env.STORAGE_ROOT)
  : path.join(__dirname, '../../../../storage');

async function save(buffer, key) {
  const fullPath = path.join(STORAGE_ROOT, key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
  return key;
}

async function read(key) {
  const fullPath = path.join(STORAGE_ROOT, key);
  return fs.readFile(fullPath);
}

async function remove(key) {
  const fullPath = path.join(STORAGE_ROOT, key);
  await fs.rm(fullPath, { force: true });
}

module.exports = { save, read, remove };
