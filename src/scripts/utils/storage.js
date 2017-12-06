import ext from "./ext";

const storage = (ext.storage.sync ? ext.storage.sync : ext.storage.local);

const defaults = {
  theme: 'default',
  fontSize: 'large',
  fontFamily: 'monospace',
  lineNumbers: true,
  readOnly: true
};

// TODO: are these already promises in each browser?

// Get values from storage as a Promise, falling back to defaults.
const get = (key) => new Promise((resolve) => {
  storage.get(key, (result) => resolve((key in result) ? result[key] : defaults[key]));
});

// Set values to storage as a Promise.
const set = (key, value) => new Promise((resolve) => {
  storage.set({ [key]: value }, resolve);
});

module.exports = { get, set };
