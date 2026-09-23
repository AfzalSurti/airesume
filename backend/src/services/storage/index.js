const localProvider = require('./localStorageProvider');

const PROVIDER = process.env.STORAGE_PROVIDER || 'local';

const providers = {
  local: localProvider,
  // s3: add an s3StorageProvider.js implementing save/read/remove and register it
  // here to switch providers via STORAGE_PROVIDER without touching any caller.
};

if (!providers[PROVIDER]) {
  throw new Error(`Unsupported STORAGE_PROVIDER: ${PROVIDER}`);
}

module.exports = providers[PROVIDER];
