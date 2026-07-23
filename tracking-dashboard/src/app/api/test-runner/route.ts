import { NextRequest, NextResponse } from 'next/server'
import { generateSign } from '@/lib/api/tracksolid'
import { logApiActivity } from '@/lib/logger'
import CryptoJS from 'crypto-js'

const APP_KEY = process.env.JIMI_APP_KEY || '8FB345B8693CCD00023DAE386436CBD0'
const APP_SECRET = process.env.JIMI_APP_SECRET || 'a23b396ab23343baa97a09208853fe61'
const BASE_URL = process.env.JIMI_BASE_URL || 'https://hk-open.tracksolidpro.com/route/rest'

function utcTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())} ` +
    `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`
}

// POST /api/test-runner — Test any Jimi IoT API endpoint with live signature calculation
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const body = await req.json()
    const { method, params = {}, customAppKey, customAppSecret } = body

    if (!method) {
      return NextResponse.json({ success: false, error: 'Method API is required (e.g. jimi.user.device.location.list)' }, { status: 400 })
    }

    const useAppKey = customAppKey || APP_KEY
    const useAppSecret = customAppSecret || APP_SECRET

    const timestamp = utcTimestamp()

    const commonParams: Record<string, string> = {
      method,
      timestamp,
      app_key: useAppKey,
      sign_method: 'md5',
      v: '1.0',
      format: 'json',
    }

    // Merge system params with user-provided params
    const allParams: Record<string, string> = { ...commonParams }
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        allParams[k] = String(params[k])
      }
    })

    // Sort keys alphabetically A-Z for signature computation breakdown
    const sortedKeys = Object.keys(allParams)
      .filter(k => k !== 'sign' && allParams[k] != null && allParams[k] !== '')
      .sort()

    let rawString = useAppSecret
    sortedKeys.forEach(k => {
      rawString += k + allParams[k]
    })
    rawString += useAppSecret

    const generatedSign = CryptoJS.MD5(rawString).toString().toUpperCase()
    allParams.sign = generatedSign

    // Send HTTP POST request to Jimi IoT server
    const postBody = new URLSearchParams(allParams).toString()

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: postBody,
    })

    const durationMs = Date.now() - startTime
    const json = await response.json()

    // Log this API activity
    logApiActivity({
      method: 'POST',
      endpoint: method,
      status: response.status,
      durationMs,
      request: allParams,
      response: json,
    })

    return NextResponse.json({
      success: true,
      signatureDebug: {
        rawString,
        sortedKeys,
        appSecretUsed: useAppSecret.slice(0, 4) + '...' + useAppSecret.slice(-4),
        generatedSign,
        timestamp,
      },
      requestPayload: allParams,
      response: json,
      httpStatus: response.status,
      durationMs,
    })
  } catch (err: any) {
    const durationMs = Date.now() - startTime
    return NextResponse.json({
      success: false,
      error: err.message,
      durationMs,
    }, { status: 500 })
  }
}
