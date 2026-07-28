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

// Get timestamp synced to Indonesia Time (WIB / UTC+7): YYYY-MM-DD HH:mm:ss.SSS
function getTimestamp(): string {
  const now = new Date()
  // Offset to WIB (UTC+7)
  const wib = new Date(now.getTime() + 7 * 3600000)
  
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth()+1)}-${pad(wib.getUTCDate())} ` +
         `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())}.${pad(now.getUTCMilliseconds(), 3)} WIB`
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

/**
 * List all available log files in the logs directory
 */
export function getAvailableLogFiles(): { name: string; date: string; size: number }[] {
  if (!fs.existsSync(LOG_DIR)) return []
  try {
    const files = fs.readdirSync(LOG_DIR)
    return files
      .filter(f => f.startsWith('api-') && f.endsWith('.log'))
      .map(f => {
        const filePath = path.join(LOG_DIR, f)
        const stat = fs.statSync(filePath)
        const dateMatch = f.match(/api-(\d{4}-\d{2}-\d{2})\.log/)
        return {
          name: f,
          date: dateMatch ? dateMatch[1] : f,
          size: stat.size,
        }
      })
      .sort((a, b) => b.name.localeCompare(a.name))
  } catch (err) {
    console.error('[Logger] Failed to list log files:', err)
    return []
  }
}

/**
 * Get raw text content of a specific daily log file (defaults to today)
 */
export function getRawDailyLog(dateStr?: string): string {
  const targetDate = dateStr || getDateStr()
  const fileName = targetDate.endsWith('.log') ? targetDate : `api-${targetDate}.log`
  const filePath = path.join(LOG_DIR, fileName)

  if (!fs.existsSync(filePath)) {
    return `Log file ${fileName} not found.`
  }

  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (err: any) {
    return `Failed to read log file: ${err.message}`
  }
}

