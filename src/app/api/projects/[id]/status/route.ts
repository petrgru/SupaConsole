import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { getProjectStatus } from '@/lib/project'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  try {
    const internalKey = request.headers.get('x-internal-key') || ''
    const bypass = internalKey && (internalKey === (process.env.INTERNAL_API_KEY || 'dev-key'))
    const sessionToken = request.cookies.get('session')?.value
    
    if (!bypass && !sessionToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const session = bypass ? { user: { id: 'internal' } } : await validateSession(sessionToken!)
    if (!bypass && !session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    const result = await getProjectStatus(id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ containers: result.containers })
  } catch (error) {
    console.error('Get project status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
