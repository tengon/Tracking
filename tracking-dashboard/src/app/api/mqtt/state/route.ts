import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const STATE_FILE = path.join(process.cwd(), 'logs', 'mqtt-state.json')

export async function GET() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8')
      return NextResponse.json(JSON.parse(data))
    }
  } catch (error) {
    // Ignore error, return default
  }
  return NextResponse.json({ active: false })
}

export async function POST(req: Request) {
  try {
    const { active } = await req.json()
    // Create logs directory if not exists
    const dir = path.dirname(STATE_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    
    fs.writeFileSync(STATE_FILE, JSON.stringify({ active, updatedAt: new Date().toISOString() }))
    return NextResponse.json({ success: true, active })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
