import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const sessionToken = request.cookies.get('session')?.value
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get project slug from database
    const { prisma } = await import('@/lib/db')
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Get memory usage for all containers of this project
    try {
      const { stdout } = await execAsync(
        `docker stats --no-stream --format "{{.Container}},{{.MemUsage}}" | grep "^${project.slug}"`
      )
      
      const containers = stdout.trim().split('\n').filter(line => line).map(line => {
        const [name, memUsage] = line.split(',')
        const [used, total] = memUsage.split(' / ')
        return {
          name: name.replace(`${project.slug}-`, ''),
          used: used.trim(),
          total: total.trim()
        }
      })

      // Calculate total memory usage
      let totalUsedMB = 0
      let totalLimitMB = 0

      containers.forEach(container => {
        const usedMatch = container.used.match(/([\d.]+)([a-zA-Z]+)/)
        const totalMatch = container.total.match(/([\d.]+)([a-zA-Z]+)/)
        
        if (usedMatch && totalMatch) {
          const usedValue = parseFloat(usedMatch[1])
          const usedUnit = usedMatch[2]
          const totalValue = parseFloat(totalMatch[1])
          const totalUnit = totalMatch[2]
          
          // Convert to MB
          const usedMB = usedUnit === 'GiB' ? usedValue * 1024 : usedValue
          const totalMB = totalUnit === 'GiB' ? totalValue * 1024 : totalValue
          
          totalUsedMB += usedMB
          totalLimitMB += totalMB
        }
      })

      return NextResponse.json({
        containers,
        totalUsed: Math.round(totalUsedMB),
        totalLimit: Math.round(totalLimitMB),
        usedPercent: totalLimitMB > 0 ? Math.round((totalUsedMB / totalLimitMB) * 100) : 0,
        unit: 'MB'
      })
    } catch (error) {
      // No containers running
      return NextResponse.json({
        containers: [],
        totalUsed: 0,
        totalLimit: 0,
        usedPercent: 0,
        unit: 'MB'
      })
    }
  } catch (error) {
    console.error('Project memory check error:', error)
    return NextResponse.json(
      { error: 'Failed to get project memory information' },
      { status: 500 }
    )
  }
}
