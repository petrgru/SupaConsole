import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Get registration status
export async function GET(request: NextRequest) {
  try {
    // Allow anonymous access to check registration status
    // (needed for register page to check if registration is open)
    
    // Get or create settings
    let settings = await prisma.systemSettings.findFirst()
    
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          registrationOpen: true
        }
      })
    }

    return NextResponse.json({
      registrationOpen: settings.registrationOpen
    })
  } catch (error) {
    console.error('Error fetching registration settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch registration settings' },
      { status: 500 }
    )
  }
}

// Toggle registration status
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session')?.value
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is authenticated
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true }
    })

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    const { registrationOpen } = await request.json()

    // Get or create settings
    let settings = await prisma.systemSettings.findFirst()
    
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          registrationOpen: registrationOpen ?? true
        }
      })
    } else {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: {
          registrationOpen: registrationOpen ?? settings.registrationOpen
        }
      })
    }

    return NextResponse.json({
      registrationOpen: settings.registrationOpen,
      message: `Registration ${settings.registrationOpen ? 'opened' : 'closed'} successfully`
    })
  } catch (error) {
    console.error('Error updating registration settings:', error)
    return NextResponse.json(
      { error: 'Failed to update registration settings' },
      { status: 500 }
    )
  }
}
