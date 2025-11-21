import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth'

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function signJWT(role: 'anon' | 'service_role', secret: string) {
  const now = Math.floor(Date.now() / 1000)
  const headerB64 = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payloadB64 = base64url(JSON.stringify({
    role,
    iss: 'supabase',
    aud: 'authenticated',
    iat: now,
    exp: now + 31536000, // 1 year
  }))
  const data = `${headerB64}.${payloadB64}`
  const sig = crypto.createHmac('sha256', secret).update(data).digest()
  const sigB64 = base64url(sig)
  return `${data}.${sigB64}`
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const internalKey = request.headers.get('x-internal-key') || ''
    const bypass = internalKey && (internalKey === (process.env.INTERNAL_API_KEY || 'dev-key'))
    if (!bypass) {
      const sessionToken = request.cookies.get('session')?.value
      if (!sessionToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const session = await validateSession(sessionToken)
      if (!session) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
      }
    }

    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Load current .env
    const dockerDir = path.join(process.cwd(), 'supabase-projects', project.slug, 'docker')
    const envPath = path.join(dockerDir, '.env')
    const content = await fs.readFile(envPath, 'utf8')

    // Extract JWT_SECRET or create one if missing
    const secretMatch = content.match(/^JWT_SECRET=(.*)$/m)
    const jwtSecret = secretMatch?.[1] ?? crypto.randomBytes(64).toString('hex')

    // Generate new keys
    const newAnon = signJWT('anon', jwtSecret)
    const newService = signJWT('service_role', jwtSecret)

    // Replace lines in .env safely
    const updated = content
      .replace(/^ANON_KEY=.*$/m, `ANON_KEY=${newAnon}`)
      .replace(/^SERVICE_ROLE_KEY=.*$/m, `SERVICE_ROLE_KEY=${newService}`)
      .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${jwtSecret}`)

    await fs.writeFile(envPath, updated)

    // Also update DB values to keep UI in sync
    await prisma.projectEnvVar.upsert({
      where: { projectId_key: { projectId: project.id, key: 'JWT_SECRET' } },
      update: { value: jwtSecret },
      create: { projectId: project.id, key: 'JWT_SECRET', value: jwtSecret },
    })
    await prisma.projectEnvVar.upsert({
      where: { projectId_key: { projectId: project.id, key: 'ANON_KEY' } },
      update: { value: newAnon },
      create: { projectId: project.id, key: 'ANON_KEY', value: newAnon },
    })
    await prisma.projectEnvVar.upsert({
      where: { projectId_key: { projectId: project.id, key: 'SERVICE_ROLE_KEY' } },
      update: { value: newService },
      create: { projectId: project.id, key: 'SERVICE_ROLE_KEY', value: newService },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
