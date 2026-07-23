import fs from 'fs'
import path from 'path'

// Log directory inside the project root: <workspace>/logs
const LOG_DIR = path.join(process.cwd(), 'logs')

// Ensure directory exists
if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  } catch (err) {
    console.error('[Logger] Failed to create log directory:', err)
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUSH' | 'PUT' | 'DELETE'

export interface LogEntry {
  timestamp: string
  method: HttpMethod
  endpoint: string
  status?: number
  durationMs?: number
  request: any
  response: any
  error?: string
}

// Helper: Sanitize sensitive data before logging
function sanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  const clone = Array.isArray(obj) ? [...obj] : { ...obj }

  const sensitiveKeys = ['user_pwd_md5', 'password', 'passwordMd5', 'appSecret', 'sign', 'accessToken', 'access_token']

  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.includes(key) && typeof clone[key] === 'string') {
      const val = clone[key]
      clone[key] = val.length > 8 ? `${val.slice(0, 4)}...${val.slice(-4)}` : '***'
    } else if (typeof clone[key] === 'object' && clone[key] !== null) {
      clone[key] = sanitize(clone[key])
    }
  }

  return clone
}

// Get current date string for file naming: YYYY-MM-DD
function getDateStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Get timestamp ISO-like local string: YYYY-MM-DD HH:mm:ss.SSS
function getTimestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}`
}

/**
 * Log API POST, GET, PUSH or Response activity to daily log files
 */
export function logApiActivity(entry: Omit<LogEntry, 'timestamp'>): void {
  const timestamp = getTimestamp()
  const dateStr = getDateStr()

  const fullEntry: LogEntry = {
    timestamp,
    method: entry.method,
    endpoint: entry.endpoint,
    status: entry.status ?? 200,
    durationMs: entry.durationMs ?? 0,
    request: sanitize(entry.request),
    response: sanitize(entry.response),
    ...(entry.error ? { error: entry.error } : {}),
  }

  // 1. Single line JSON formatted string for programmatic parsing
  const logLine = JSON.stringify(fullEntry) + '\n'

  // 2. Human readable formatted block
  const formattedBlock =
    `[${timestamp}] [${entry.method}] ${entry.endpoint} | Status: ${entry.status ?? 200} | ${entry.durationMs ?? 0}ms\n` +
    `   ➜ REQ: ${JSON.stringify(sanitize(entry.request))}\n` +
    `   ➜ RES: ${JSON.stringify(sanitize(entry.response))}\n` +
    (entry.error ? `   ⚠ ERR: ${entry.error}\n` : '') +
    '--------------------------------------------------------------------------------\n'

  // Daily log file: logs/api-YYYY-MM-DD.log
  const dailyLogFile = path.join(LOG_DIR, `api-${dateStr}.log`)
  // Main combined log file: logs/api-activity.log
  const combinedLogFile = path.join(LOG_DIR, 'api-activity.log')

  try {
    fs.appendFileSync(dailyLogFile, formattedBlock, 'utf-8')
    fs.appendFileSync(combinedLogFile, logLine, 'utf-8')
  } catch (err) {
    console.error('[Logger] Failed to write log to file:', err)
  }

  // Also print clean console output in development
  console.log(`[LOG] [${entry.method}] ${entry.endpoint} (${entry.durationMs ?? 0}ms)`)
}

/**
 * Read the last N logs from the daily or combined log file
 */
export function getRecentLogs(limit = 50): LogEntry[] {
  const combinedLogFile = path.join(LOG_DIR, 'api-activity.log')
  if (!fs.existsSync(combinedLogFile)) return []

  try {
    const fileContent = fs.readFileSync(combinedLogFile, 'utf-8')
    const lines = fileContent.trim().split('\n').filter(Boolean)
    const recent = lines.slice(-limit).reverse()
    return recent.map(line => {
      try {
        return JSON.parse(line)
      } catch {
        return {
          timestamp: getTimestamp(),
          method: 'GET' as HttpMethod,
          endpoint: 'raw-log',
          request: {},
          response: line,
        }
      }
    })
  } catch (err) {
    console.error('[Logger] Failed to read log file:', err)
    return []
  }
}
