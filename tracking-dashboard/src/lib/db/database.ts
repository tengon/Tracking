import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'local.db')
const db = new Database(dbPath)

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS user_prefs (
    account TEXT PRIMARY KEY,
    display_name TEXT,
    color TEXT,
    map_center_lat REAL,
    map_center_lng REAL,
    map_zoom INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS device_labels (
    imei TEXT PRIMARY KEY,
    custom_name TEXT,
    group_name TEXT,
    notes TEXT,
    assigned_to_account TEXT,
    color_override TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account TEXT,
    action TEXT,
    detail TEXT,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

// --- Helper Functions ---

// Device Labels / Assignments
export function getDeviceLabels() {
  const stmt = db.prepare('SELECT * FROM device_labels')
  return stmt.all()
}

export function getDeviceLabelByImei(imei: string) {
  const stmt = db.prepare('SELECT * FROM device_labels WHERE imei = ?')
  return stmt.get(imei)
}

export function upsertDeviceLabel(data: {
  imei: string;
  custom_name?: string;
  group_name?: string;
  notes?: string;
  assigned_to_account?: string;
  color_override?: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO device_labels (imei, custom_name, group_name, notes, assigned_to_account, color_override, updated_at)
    VALUES (@imei, @custom_name, @group_name, @notes, @assigned_to_account, @color_override, CURRENT_TIMESTAMP)
    ON CONFLICT(imei) DO UPDATE SET
      custom_name = excluded.custom_name,
      group_name = excluded.group_name,
      notes = excluded.notes,
      assigned_to_account = excluded.assigned_to_account,
      color_override = excluded.color_override,
      updated_at = CURRENT_TIMESTAMP
  `)
  return stmt.run(data)
}

// User Prefs
export function getUserPrefs(account: string) {
  const stmt = db.prepare('SELECT * FROM user_prefs WHERE account = ?')
  return stmt.get(account)
}

export function upsertUserPrefs(data: {
  account: string;
  display_name?: string;
  color?: string;
  map_center_lat?: number;
  map_center_lng?: number;
  map_zoom?: number;
}) {
  const stmt = db.prepare(`
    INSERT INTO user_prefs (account, display_name, color, map_center_lat, map_center_lng, map_zoom)
    VALUES (@account, @display_name, @color, @map_center_lat, @map_center_lng, @map_zoom)
    ON CONFLICT(account) DO UPDATE SET
      display_name = excluded.display_name,
      color = excluded.color,
      map_center_lat = excluded.map_center_lat,
      map_center_lng = excluded.map_center_lng,
      map_zoom = excluded.map_zoom
  `)
  return stmt.run(data)
}

export default db
