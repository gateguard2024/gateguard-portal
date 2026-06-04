import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json({ success: false, message: 'Lead actions are not enabled yet.' }, { status: 501 })
}
