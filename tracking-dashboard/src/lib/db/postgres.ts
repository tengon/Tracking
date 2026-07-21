import { Pool } from 'pg'

// Singleton pattern - reuse connection pool across Next.js hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined
}

let pool: Pool

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({ connectionString: process.env.DATABASE_URL })
} else {
  if (!global.__pgPool) {
    global.__pgPool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  pool = global.__pgPool
}

export default pool

// Ensure PostgreSQL tables exist
pool.query(`
  CREATE TABLE IF NOT EXISTS accounts (
    account TEXT PRIMARY KEY,
    parent_account TEXT,
    name TEXT,
    company_name TEXT,
    email TEXT,
    phone TEXT,
    type INT DEFAULT 0,
    enabled INT DEFAULT 1,
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_account);

  CREATE TABLE IF NOT EXISTS devices (
    imei TEXT PRIMARY KEY,
    account TEXT,
    device_name TEXT,
    device_type TEXT,
    model TEXT,
    sim_card TEXT,
    license_plate TEXT,
    vin TEXT,
    brand TEXT,
    color TEXT,
    install_date TEXT,
    expiry_date TEXT,
    activate_date TEXT,
    mileage NUMERIC,
    mc_type TEXT,
    mc_type_use_scope TEXT,
    iccid TEXT,
    imsi TEXT,
    status TEXT,
    customer_name TEXT,
    device_group TEXT,
    device_group_id TEXT,
    vehicle_brand TEXT,
    vehicle_models TEXT,
    vehicle_icon TEXT,
    engine_number TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    import_time TIMESTAMPTZ,
    current_mileage NUMERIC,
    raw_detail JSONB,
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_devices_account ON devices(account);

  CREATE TABLE IF NOT EXISTS device_details (
    imei TEXT PRIMARY KEY,
    device_name TEXT,
    account TEXT,
    customer_name TEXT,
    mc_type TEXT,
    mc_type_use_scope TEXT,
    sim TEXT,
    expiration TEXT,
    user_expiration TEXT,
    activation_time TEXT,
    remark TEXT,
    vehicle_name TEXT,
    vehicle_icon TEXT,
    vehicle_number TEXT,
    vehicle_models TEXT,
    car_frame TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    enabled_flag INT DEFAULT 1,
    engine_number TEXT,
    iccid TEXT,
    import_time TEXT,
    imsi TEXT,
    license_plat_no TEXT,
    vin TEXT,
    vehicle_brand TEXT,
    fuel_100km TEXT,
    status TEXT,
    current_mileage TEXT,
    device_group_id TEXT,
    device_group TEXT,
    raw_detail JSONB,
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_device_details_account ON device_details(account);
`).catch(err => console.error('Error initializing PostgreSQL tables:', err))

// ─── Account Table Helpers ────────────────────────────────────────────────────

export interface AccountRow {
  account: string
  parent_account: string | null
  name: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  type: number
  enabled: number
  last_sync_at: Date
  created_at: Date
}

/** Upsert a single account row */
export async function upsertAccount(data: {
  account: string
  parent_account?: string | null
  name?: string
  company_name?: string
  email?: string
  phone?: string
  type?: number
}) {
  await pool.query(
    `INSERT INTO accounts (account, parent_account, name, company_name, email, phone, type, last_sync_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (account) DO UPDATE SET
       parent_account = EXCLUDED.parent_account,
       name = EXCLUDED.name,
       company_name = EXCLUDED.company_name,
       email = EXCLUDED.email,
       phone = EXCLUDED.phone,
       type = EXCLUDED.type,
       last_sync_at = NOW()`,
    [
      data.account,
      data.parent_account ?? null,
      data.name ?? null,
      data.company_name ?? null,
      data.email ?? null,
      data.phone ?? null,
      data.type ?? 0,
    ]
  )
}

/** Get all accounts */
export async function getAllAccounts(): Promise<AccountRow[]> {
  const res = await pool.query<AccountRow>('SELECT * FROM accounts ORDER BY account')
  return res.rows
}

/** Get direct children of a given account */
export async function getAccountChildren(parent: string): Promise<AccountRow[]> {
  const res = await pool.query<AccountRow>(
    'SELECT * FROM accounts WHERE parent_account = $1 ORDER BY account',
    [parent]
  )
  return res.rows
}

/** Get all descendant account IDs including the target itself (using recursive CTE) */
export async function getDescendants(rootAccount: string): Promise<Array<{ account: string; depth: number }>> {
  const res = await pool.query<{ account: string; depth: number }>(
    `WITH RECURSIVE tree AS (
       SELECT account, parent_account, 0 AS depth
       FROM accounts
       WHERE account = $1
       UNION ALL
       SELECT a.account, a.parent_account, t.depth + 1
       FROM accounts a
       JOIN tree t ON a.parent_account = t.account
     )
     SELECT account, depth FROM tree ORDER BY depth, account`,
    [rootAccount]
  )
  return res.rows
}

/** Build a full nested tree structure starting from a root account */
export async function buildAccountTree(rootAccount: string): Promise<any> {
  const all = await getAllAccounts()
  const map = new Map<string, any>()

  all.forEach(a => {
    map.set(a.account, {
      account: a.account,
      name: a.name,
      customerName: a.company_name || a.name,
      children: [],
    })
  })

  let root: any = null
  all.forEach(a => {
    if (a.account === rootAccount) {
      root = map.get(a.account)
    } else if (a.parent_account && map.has(a.parent_account)) {
      map.get(a.parent_account).children.push(map.get(a.account))
    }
  })

  return root
}

/** Check if accounts table has any data for a given root */
export async function hasAccountData(rootAccount: string): Promise<boolean> {
  const res = await pool.query(
    'SELECT 1 FROM accounts WHERE account = $1 LIMIT 1',
    [rootAccount]
  )
  return (res.rowCount ?? 0) > 0
}

// ─── Device Table Helpers ─────────────────────────────────────────────────────

export interface DeviceRow {
  imei: string
  account: string | null
  device_name: string | null
  device_type: string | null
  model: string | null
  sim_card: string | null
  license_plate: string | null
  vin: string | null
  brand: string | null
  color: string | null
  install_date: string | null
  expiry_date: string | null
  activate_date: string | null
  mileage: number | null
  mc_type: string | null
  mc_type_use_scope: string | null
  iccid: string | null
  imsi: string | null
  status: string | null
  customer_name: string | null
  device_group: string | null
  device_group_id: string | null
  vehicle_brand: string | null
  vehicle_models: string | null
  vehicle_icon: string | null
  engine_number: string | null
  driver_name: string | null
  driver_phone: string | null
  import_time: Date | null
  current_mileage: number | null
  raw_detail: any
  last_sync_at: Date
  created_at: Date
}

/** Upsert a device row with full details from jimi.track.device.detail */
export async function upsertDevice(data: {
  imei: string
  account?: string | null
  device_name?: string | null
  device_type?: string | null
  model?: string | null
  sim_card?: string | null
  license_plate?: string | null
  vin?: string | null
  brand?: string | null
  color?: string | null
  install_date?: string | null
  expiry_date?: string | null
  activate_date?: string | null
  mileage?: number | null
  mc_type?: string | null
  mc_type_use_scope?: string | null
  iccid?: string | null
  imsi?: string | null
  status?: string | null
  customer_name?: string | null
  device_group?: string | null
  device_group_id?: string | null
  vehicle_brand?: string | null
  vehicle_models?: string | null
  vehicle_icon?: string | null
  engine_number?: string | null
  driver_name?: string | null
  driver_phone?: string | null
  import_time?: string | Date | null
  current_mileage?: number | null
  raw_detail?: any
}) {
  await pool.query(
    `INSERT INTO devices (
       imei, account, device_name, device_type, model, sim_card, license_plate, vin, brand, color,
       install_date, expiry_date, activate_date, mileage, mc_type, mc_type_use_scope, iccid, imsi,
       status, customer_name, device_group, device_group_id, vehicle_brand, vehicle_models,
       vehicle_icon, engine_number, driver_name, driver_phone, import_time, current_mileage,
       raw_detail, last_sync_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
       $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
       $31, NOW()
     )
     ON CONFLICT (imei) DO UPDATE SET
       account = EXCLUDED.account,
       device_name = EXCLUDED.device_name,
       device_type = EXCLUDED.device_type,
       model = EXCLUDED.model,
       sim_card = EXCLUDED.sim_card,
       license_plate = EXCLUDED.license_plate,
       vin = EXCLUDED.vin,
       brand = EXCLUDED.brand,
       color = EXCLUDED.color,
       install_date = EXCLUDED.install_date,
       expiry_date = EXCLUDED.expiry_date,
       activate_date = EXCLUDED.activate_date,
       mileage = EXCLUDED.mileage,
       mc_type = EXCLUDED.mc_type,
       mc_type_use_scope = EXCLUDED.mc_type_use_scope,
       iccid = EXCLUDED.iccid,
       imsi = EXCLUDED.imsi,
       status = EXCLUDED.status,
       customer_name = EXCLUDED.customer_name,
       device_group = EXCLUDED.device_group,
       device_group_id = EXCLUDED.device_group_id,
       vehicle_brand = EXCLUDED.vehicle_brand,
       vehicle_models = EXCLUDED.vehicle_models,
       vehicle_icon = EXCLUDED.vehicle_icon,
       engine_number = EXCLUDED.engine_number,
       driver_name = EXCLUDED.driver_name,
       driver_phone = EXCLUDED.driver_phone,
       import_time = EXCLUDED.import_time,
       current_mileage = EXCLUDED.current_mileage,
       raw_detail = EXCLUDED.raw_detail,
       last_sync_at = NOW()`,
    [
      data.imei,
      data.account ?? null,
      data.device_name ?? null,
      data.device_type ?? null,
      data.model ?? null,
      data.sim_card ?? null,
      data.license_plate ?? null,
      data.vin ?? null,
      data.brand ?? null,
      data.color ?? null,
      data.install_date ?? null,
      data.expiry_date ?? null,
      data.activate_date ?? null,
      data.mileage ?? null,
      data.mc_type ?? null,
      data.mc_type_use_scope ?? null,
      data.iccid ?? null,
      data.imsi ?? null,
      data.status ?? null,
      data.customer_name ?? null,
      data.device_group ?? null,
      data.device_group_id ?? null,
      data.vehicle_brand ?? null,
      data.vehicle_models ?? null,
      data.vehicle_icon ?? null,
      data.engine_number ?? null,
      data.driver_name ?? null,
      data.driver_phone ?? null,
      data.import_time ? new Date(data.import_time) : null,
      data.current_mileage ?? null,
      data.raw_detail ? JSON.stringify(data.raw_detail) : null,
    ]
  )
}

/** Get all devices */
export async function getAllDevices(): Promise<DeviceRow[]> {
  const res = await pool.query<DeviceRow>('SELECT * FROM devices ORDER BY device_name, imei')
  return res.rows
}

/** Get devices belonging to a specific account */
export async function getDevicesByAccount(account: string): Promise<DeviceRow[]> {
  const res = await pool.query<DeviceRow>(
    'SELECT * FROM devices WHERE account = $1 ORDER BY device_name',
    [account]
  )
  return res.rows
}

/** Get devices belonging to an account and all its descendants */
export async function getDevicesForTree(rootAccount: string): Promise<DeviceRow[]> {
  const res = await pool.query<DeviceRow>(
    `WITH RECURSIVE tree AS (
       SELECT account FROM accounts WHERE account = $1
       UNION ALL
       SELECT a.account FROM accounts a JOIN tree t ON a.parent_account = t.account
     )
     SELECT d.* FROM devices d
     JOIN tree t ON d.account = t.account
     ORDER BY d.device_name`,
    [rootAccount]
  )
  return res.rows
}

/** Get a single device by IMEI */
export async function getDeviceByImei(imei: string): Promise<DeviceRow | null> {
  const res = await pool.query<DeviceRow>(
    'SELECT * FROM devices WHERE imei = $1',
    [imei]
  )
  return res.rows[0] ?? null
}

/** Check if devices table has data for a given account */
export async function hasDeviceData(account: string): Promise<boolean> {
  const res = await pool.query(
    'SELECT 1 FROM devices WHERE account = $1 LIMIT 1',
    [account]
  )
  return (res.rowCount ?? 0) > 0
}

// ─── Dedicated Device Details Table (jimi.track.device.detail) ──────────────

export interface DeviceDetailRow {
  imei: string
  device_name: string | null
  account: string | null
  customer_name: string | null
  mc_type: string | null
  mc_type_use_scope: string | null
  sim: string | null
  expiration: string | null
  user_expiration: string | null
  activation_time: string | null
  remark: string | null
  vehicle_name: string | null
  vehicle_icon: string | null
  vehicle_number: string | null
  vehicle_models: string | null
  car_frame: string | null
  driver_name: string | null
  driver_phone: string | null
  enabled_flag: number
  engine_number: string | null
  iccid: string | null
  import_time: string | null
  imsi: string | null
  license_plat_no: string | null
  vin: string | null
  vehicle_brand: string | null
  fuel_100km: string | null
  status: string | null
  current_mileage: string | null
  device_group_id: string | null
  device_group: string | null
  raw_detail?: any
  last_sync_at: Date
}

/** Initialize dedicated PostgreSQL tables */
export async function initPostgresTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS device_details (
      imei TEXT PRIMARY KEY,
      device_name TEXT,
      account TEXT,
      customer_name TEXT,
      mc_type TEXT,
      mc_type_use_scope TEXT,
      sim TEXT,
      expiration TEXT,
      user_expiration TEXT,
      activation_time TEXT,
      remark TEXT,
      vehicle_name TEXT,
      vehicle_icon TEXT,
      vehicle_number TEXT,
      vehicle_models TEXT,
      car_frame TEXT,
      driver_name TEXT,
      driver_phone TEXT,
      enabled_flag INT DEFAULT 1,
      engine_number TEXT,
      iccid TEXT,
      import_time TEXT,
      imsi TEXT,
      license_plat_no TEXT,
      vin TEXT,
      vehicle_brand TEXT,
      fuel_100km TEXT,
      status TEXT,
      current_mileage TEXT,
      device_group_id TEXT,
      device_group TEXT,
      raw_detail JSONB,
      last_sync_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_device_details_account ON device_details(account);

    CREATE TABLE IF NOT EXISTS geofences (
      fence_id TEXT PRIMARY KEY,
      fence_name TEXT NOT NULL,
      account TEXT,
      fence_type TEXT DEFAULT 'CIRCLE',
      coordinates TEXT,
      center_lat NUMERIC,
      center_lng NUMERIC,
      radius NUMERIC DEFAULT 500,
      alarm_type TEXT DEFAULT 'IN_OUT',
      zoom_level INT DEFAULT 14,
      color TEXT DEFAULT '#3B82F6',
      enabled INT DEFAULT 1,
      bound_imeis JSONB DEFAULT '[]'::jsonb,
      raw_detail JSONB,
      last_sync_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_geofences_account ON geofences(account);

    CREATE TABLE IF NOT EXISTS geofence_device_bindings (
      id SERIAL PRIMARY KEY,
      fence_id TEXT NOT NULL,
      imei TEXT NOT NULL,
      account TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT unq_fence_imei UNIQUE (fence_id, imei)
    );
    CREATE INDEX IF NOT EXISTS idx_bindings_fence ON geofence_device_bindings(fence_id);
    CREATE INDEX IF NOT EXISTS idx_bindings_imei ON geofence_device_bindings(imei);

    CREATE TABLE IF NOT EXISTS geofence_events (
      id BIGSERIAL PRIMARY KEY,
      fence_id TEXT,
      fence_name TEXT,
      imei TEXT NOT NULL,
      device_name TEXT,
      account TEXT,
      event_type TEXT NOT NULL,
      lat NUMERIC,
      lng NUMERIC,
      speed NUMERIC,
      event_time TIMESTAMPTZ DEFAULT NOW(),
      raw_detail JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_geo_events_imei ON geofence_events(imei);
    CREATE INDEX IF NOT EXISTS idx_geo_events_fence ON geofence_events(fence_id);
    CREATE INDEX IF NOT EXISTS idx_geo_events_account ON geofence_events(account);
  `)
}

/** Upsert a row into device_details table directly from jimi.track.device.detail payload */
export async function upsertDeviceDetail(detail: any) {
  const imei = detail.imei || detail.deviceId
  if (!imei) return

  await pool.query(
    `INSERT INTO device_details (
       imei, device_name, account, customer_name, mc_type, mc_type_use_scope,
       sim, expiration, user_expiration, activation_time, remark, vehicle_name,
       vehicle_icon, vehicle_number, vehicle_models, car_frame, driver_name,
       driver_phone, enabled_flag, engine_number, iccid, import_time, imsi,
       license_plat_no, vin, vehicle_brand, fuel_100km, status, current_mileage,
       device_group_id, device_group, raw_detail, last_sync_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10, $11, $12,
       $13, $14, $15, $16, $17,
       $18, $19, $20, $21, $22, $23,
       $24, $25, $26, $27, $28, $29,
       $30, $31, $32, NOW()
     )
     ON CONFLICT (imei) DO UPDATE SET
       device_name = EXCLUDED.device_name,
       account = EXCLUDED.account,
       customer_name = EXCLUDED.customer_name,
       mc_type = EXCLUDED.mc_type,
       mc_type_use_scope = EXCLUDED.mc_type_use_scope,
       sim = EXCLUDED.sim,
       expiration = EXCLUDED.expiration,
       user_expiration = EXCLUDED.user_expiration,
       activation_time = EXCLUDED.activation_time,
       remark = EXCLUDED.remark,
       vehicle_name = EXCLUDED.vehicle_name,
       vehicle_icon = EXCLUDED.vehicle_icon,
       vehicle_number = EXCLUDED.vehicle_number,
       vehicle_models = EXCLUDED.vehicle_models,
       car_frame = EXCLUDED.car_frame,
       driver_name = EXCLUDED.driver_name,
       driver_phone = EXCLUDED.driver_phone,
       enabled_flag = EXCLUDED.enabled_flag,
       engine_number = EXCLUDED.engine_number,
       iccid = EXCLUDED.iccid,
       import_time = EXCLUDED.import_time,
       imsi = EXCLUDED.imsi,
       license_plat_no = EXCLUDED.license_plat_no,
       vin = EXCLUDED.vin,
       vehicle_brand = EXCLUDED.vehicle_brand,
       fuel_100km = EXCLUDED.fuel_100km,
       status = EXCLUDED.status,
       current_mileage = EXCLUDED.current_mileage,
       device_group_id = EXCLUDED.device_group_id,
       device_group = EXCLUDED.device_group,
       raw_detail = EXCLUDED.raw_detail,
       last_sync_at = NOW()`,
    [
      imei,
      detail.deviceName ?? null,
      detail.account ?? null,
      detail.customerName ?? null,
      detail.mcType ?? null,
      detail.mcTypeUseScope ?? null,
      detail.sim ?? detail.simCard ?? null,
      detail.expiration ?? detail.expireTime ?? null,
      detail.user_expiration ?? null,
      detail.activationTime ?? detail.activateTime ?? null,
      detail.reMark ?? detail.remark ?? null,
      detail.vehicleName ?? null,
      detail.vehicleIcon ?? null,
      detail.vehicleNumber ?? detail.carNumber ?? null,
      detail.vehicleModels ?? null,
      detail.carFrame ?? detail.frameNumber ?? null,
      detail.driverName ?? null,
      detail.driverPhone ?? null,
      detail.enabledFlag !== undefined ? Number(detail.enabledFlag) : 1,
      detail.engineNumber ?? null,
      detail.iccid ?? null,
      detail.importTime ?? null,
      detail.imsi ?? null,
      detail.licensePlatNo ?? detail.carNumber ?? null,
      detail.vin ?? null,
      detail.vehicleBrand ?? detail.carBrand ?? null,
      detail.fuel_100km ? String(detail.fuel_100km) : null,
      detail.status ? String(detail.status) : null,
      detail.currentMileage ? String(detail.currentMileage) : null,
      detail.deviceGroupId ?? null,
      detail.deviceGroup ?? null,
      JSON.stringify(detail),
    ]
  )
}

// ─── Geofences Table Helpers ──────────────────────────────────────────────────

export interface GeofenceRow {
  fence_id: string
  fence_name: string
  account: string | null
  fence_type: string
  coordinates: string | null
  center_lat: number | null
  center_lng: number | null
  radius: number | null
  alarm_type: string
  zoom_level: number
  color: string
  enabled: number
  bound_imeis: string[] | any
  raw_detail: any
  last_sync_at: Date
  created_at: Date
  updated_at: Date
}

export interface GeofenceEventRow {
  id: number
  fence_id: string | null
  fence_name: string | null
  imei: string
  device_name: string | null
  account: string | null
  event_type: string
  lat: number | null
  lng: number | null
  speed: number | null
  event_time: Date
  raw_detail: any
}

/** Upsert a geofence row into PostgreSQL */
export async function upsertGeofence(data: {
  fence_id: string
  fence_name: string
  account?: string | null
  fence_type?: string
  coordinates?: string | null
  center_lat?: number | null
  center_lng?: number | null
  radius?: number | null
  alarm_type?: string
  zoom_level?: number
  color?: string
  enabled?: number
  bound_imeis?: string[] | any
  raw_detail?: any
}) {
  await pool.query(
    `INSERT INTO geofences (
       fence_id, fence_name, account, fence_type, coordinates, center_lat, center_lng,
       radius, alarm_type, zoom_level, color, enabled, bound_imeis, raw_detail,
       last_sync_at, updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11, $12, $13, $14,
       NOW(), NOW()
     )
     ON CONFLICT (fence_id) DO UPDATE SET
       fence_name = EXCLUDED.fence_name,
       account = EXCLUDED.account,
       fence_type = EXCLUDED.fence_type,
       coordinates = EXCLUDED.coordinates,
       center_lat = EXCLUDED.center_lat,
       center_lng = EXCLUDED.center_lng,
       radius = EXCLUDED.radius,
       alarm_type = EXCLUDED.alarm_type,
       zoom_level = EXCLUDED.zoom_level,
       color = EXCLUDED.color,
       enabled = EXCLUDED.enabled,
       bound_imeis = EXCLUDED.bound_imeis,
       raw_detail = EXCLUDED.raw_detail,
       last_sync_at = NOW(),
       updated_at = NOW()`,
    [
      data.fence_id,
      data.fence_name,
      data.account ?? null,
      data.fence_type ?? 'CIRCLE',
      data.coordinates ?? null,
      data.center_lat ?? null,
      data.center_lng ?? null,
      data.radius ?? 500,
      data.alarm_type ?? 'IN_OUT',
      data.zoom_level ?? 14,
      data.color ?? '#3B82F6',
      data.enabled ?? 1,
      JSON.stringify(data.bound_imeis || []),
      data.raw_detail ? JSON.stringify(data.raw_detail) : null,
    ]
  )
}

/** Get all geofences */
export async function getAllGeofences(): Promise<GeofenceRow[]> {
  const res = await pool.query<GeofenceRow>('SELECT * FROM geofences ORDER BY fence_name')
  return res.rows
}

/** Get geofences for an account */
export async function getGeofencesByAccount(account: string): Promise<GeofenceRow[]> {
  const res = await pool.query<GeofenceRow>(
    'SELECT * FROM geofences WHERE account = $1 ORDER BY fence_name',
    [account]
  )
  return res.rows
}

/** Get geofences for an account and all its sub-accounts */
export async function getGeofencesForTree(rootAccount: string): Promise<GeofenceRow[]> {
  const res = await pool.query<GeofenceRow>(
    `WITH RECURSIVE tree AS (
       SELECT account FROM accounts WHERE account = $1
       UNION ALL
       SELECT a.account FROM accounts a JOIN tree t ON a.parent_account = t.account
     )
     SELECT g.* FROM geofences g
     JOIN tree t ON g.account = t.account
     ORDER BY g.fence_name`,
    [rootAccount]
  )
  return res.rows
}

/** Get a single geofence by fence_id */
export async function getGeofenceById(fenceId: string): Promise<GeofenceRow | null> {
  const res = await pool.query<GeofenceRow>('SELECT * FROM geofences WHERE fence_id = $1', [fenceId])
  return res.rows[0] ?? null
}

/** Delete a geofence by fence_id */
export async function deleteGeofence(fenceId: string): Promise<boolean> {
  const res = await pool.query('DELETE FROM geofences WHERE fence_id = $1', [fenceId])
  return (res.rowCount ?? 0) > 0
}

/** Bind IMEIs to a geofence */
export async function bindGeofenceToDevices(fenceId: string, imeis: string[], account?: string) {
  // Update bound_imeis in geofences table
  await pool.query(
    'UPDATE geofences SET bound_imeis = $1, updated_at = NOW() WHERE fence_id = $2',
    [JSON.stringify(imeis), fenceId]
  )

  // Insert/upsert into geofence_device_bindings table
  for (const imei of imeis) {
    await pool.query(
      `INSERT INTO geofence_device_bindings (fence_id, imei, account)
       VALUES ($1, $2, $3)
       ON CONFLICT (fence_id, imei) DO NOTHING`,
      [fenceId, imei, account ?? null]
    )
  }
}

/** Log a geofence enter/exit event */
export async function logGeofenceEvent(data: {
  fence_id?: string
  fence_name?: string
  imei: string
  device_name?: string
  account?: string
  event_type: 'ENTER' | 'EXIT'
  lat?: number
  lng?: number
  speed?: number
  raw_detail?: any
}) {
  await pool.query(
    `INSERT INTO geofence_events (
       fence_id, fence_name, imei, device_name, account, event_type, lat, lng, speed, raw_detail
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      data.fence_id ?? null,
      data.fence_name ?? null,
      data.imei,
      data.device_name ?? null,
      data.account ?? null,
      data.event_type,
      data.lat ?? null,
      data.lng ?? null,
      data.speed ?? null,
      data.raw_detail ? JSON.stringify(data.raw_detail) : null,
    ]
  )
}

/** Get geofence events with optional filtering */
export async function getGeofenceEvents(params?: {
  account?: string
  imei?: string
  fenceId?: string
  limit?: number
}): Promise<GeofenceEventRow[]> {
  let query = 'SELECT * FROM geofence_events WHERE 1=1'
  const values: any[] = []

  if (params?.account) {
    values.push(params.account)
    query += ` AND account = $${values.length}`
  }
  if (params?.imei) {
    values.push(params.imei)
    query += ` AND imei = $${values.length}`
  }
  if (params?.fenceId) {
    values.push(params.fenceId)
    query += ` AND fence_id = $${values.length}`
  }

  query += ` ORDER BY event_time DESC LIMIT ${params?.limit || 100}`

  const res = await pool.query<GeofenceEventRow>(query, values)
  return res.rows
}

/** Check if geofences table has data */
export async function hasGeofenceData(account?: string): Promise<boolean> {
  if (account) {
    const res = await pool.query('SELECT 1 FROM geofences WHERE account = $1 LIMIT 1', [account])
    return (res.rowCount ?? 0) > 0
  }
  const res = await pool.query('SELECT 1 FROM geofences LIMIT 1')
  return (res.rowCount ?? 0) > 0
}

