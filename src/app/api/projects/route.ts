import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth'
import { createProject } from '@/lib/project'

export async function GET(request: NextRequest) {
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

  const projects = await prisma.project.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: bypass ? {} : { ownerId: (session as any).user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Get projects error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const { name, description = '' } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerId = bypass ? 'internal' : (session as any).user.id
  const result = await createProject(name, ownerId, description)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ project: result.project })
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}