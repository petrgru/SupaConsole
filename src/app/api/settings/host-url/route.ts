import { NextResponse } from 'next/server'

export async function GET() {
  const hostUrl = process.env.HOST_URL || 'http://localhost'
  
  return NextResponse.json({
    hostUrl
  })
}
