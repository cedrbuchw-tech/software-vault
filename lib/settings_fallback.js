import fs from "fs";
import path from "path";

const SETTINGS_FILE = path.join(process.cwd(), ".vault-settings.json");

function readStore() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(data) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

export function getLocalSettings() {
  return readStore();
}

export function getLocalSetting(key) {
  const store = readStore();
  return store[key] ?? null;
}

export function setLocalSetting(key, value) {
  const store = readStore();
  store[key] = value;
  writeStore(store);
}

export function setLocalSettings(updates) {
  const store = readStore();
  Object.assign(store, updates);
  writeStore(store);
}

export function deleteLocalSetting(key) {
  const store = readStore();
  delete store[key];
  writeStore(store);
}

export function hasLocalSettings() {
  return Object.keys(readStore()).length > 0;
}
