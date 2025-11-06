import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile } from 'fs/promises'

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

    try {
      // Get container names for this project first
      const { stdout: containerNames } = await execAsync(
        `docker ps --filter "name=${project.slug}" --format "{{.Names}}"`
      )

      const containerNameList = containerNames.trim().split('\n').filter((name: string) => name)
      
      // Helper utils for size parsing/formatting
      const parseSizeToBytes = (input: string): number => {
        if (!input) return 0
        const s = input.trim()
        if (s === 'N/A' || s === '-' || s === '0' || s === '0B' || s === '0b') return 0
        const m = s.match(/([\d.]+)\s*([A-Za-z]+)/)
        if (!m) return 0
        const val = parseFloat(m[1])
        const unit = m[2].toUpperCase()
        const map: Record<string, number> = {
          B: 1,
          KB: 1024,
          KIB: 1024,
          MB: 1024 * 1024,
          MIB: 1024 * 1024,
          GB: 1024 * 1024 * 1024,
          GIB: 1024 * 1024 * 1024,
          TB: 1024 ** 4,
          TIB: 1024 ** 4,
        }
        const mul = map[unit] ?? 1
        return Math.round(val * mul)
      }

      const formatBytes = (bytes: number): string => {
        if (!bytes || bytes <= 0) return '0 B'
        const units = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(1024))
        const val = bytes / Math.pow(1024, i)
        return `${val.toFixed(val >= 10 ? 0 : 1)} ${units[i]}`
      }

      // Get detailed container stats using docker stats for specific containers
      let statsOutput = ''
      if (containerNameList.length > 0) {
        const { stdout } = await execAsync(
          `docker stats --no-stream --format "{{.Container}}|{{.MemUsage}}|{{.MemPerc}}|{{.CPUPerc}}|{{.NetIO}}|{{.BlockIO}}" ${containerNameList.join(' ')}`
        )
        statsOutput = stdout
      }

      interface ContainerStats {
        name: string
        fullName: string
        memory: {
          used: number
          limit: number
          percent: number
        }
        cpu: number
        network: string
        blockIO: string
      }

      const containers: ContainerStats[] = []
      let totalMemoryUsedMB = 0
      let totalMemoryLimitMB = 0
      
      // Parse stats output
      const statsLines = statsOutput.trim().split('\n').filter(line => line)
      
      for (const line of statsLines) {
        const [name, memUsage, memPerc, cpuPerc, netIO, blockIO] = line.split('|')
        
        if (!name || !memUsage) continue
        
        const [used, total] = memUsage.split(' / ')
        const usedMatch = used?.trim().match(/([\d.]+)([a-zA-Z]+)/)
        const totalMatch = total?.trim().match(/([\d.]+)([a-zA-Z]+)/)
        
        if (usedMatch && totalMatch) {
          const usedValue = parseFloat(usedMatch[1])
          const usedUnit = usedMatch[2]
          const totalValue = parseFloat(totalMatch[1])
          const totalUnit = totalMatch[2]
          
          // Convert to MB
          const usedMB = usedUnit === 'GiB' ? usedValue * 1024 : usedValue
          const totalMB = totalUnit === 'GiB' ? totalValue * 1024 : totalValue
          
          totalMemoryUsedMB += usedMB
          totalMemoryLimitMB += totalMB
          
          containers.push({
            name: name.replace(`${project.slug}-`, ''),
            fullName: name,
            memory: {
              used: Math.round(usedMB),
              limit: Math.round(totalMB),
              percent: parseFloat(memPerc?.replace('%', '') || '0')
            },
            cpu: parseFloat(cpuPerc?.replace('%', '') || '0'),
            network: netIO || 'N/A',
            blockIO: blockIO || 'N/A'
          })
        }
      }

      // Get detailed info for each container
      interface DetailedContainer {
        id: string
        name: string
        fullName: string
        status: string
        image: string
        created: string
        restartCount: number
        memory: {
          used: number
          limit: number
          percent: number
        }
        cpu: number
        network: string
        blockIO: string
      }

      const detailedContainers = await Promise.all(
        containerNameList.map(async (containerName: string): Promise<DetailedContainer | null> => {
          try {
            // Get container inspect data
            const { stdout: inspectOutput } = await execAsync(
              `docker inspect ${containerName} --format '{{.Id}}|{{.Name}}|{{.State.Status}}|{{.RestartCount}}|{{.Config.Image}}|{{.Created}}'`
            )
            
            const [containerId, fullName, status, restartCount, image, created] = inspectOutput.trim().split('|')
            const shortName = fullName.replace(/^\//, '').replace(`${project.slug}-`, '')
            const fullContainerName = fullName.replace(/^\//, '')
            
            // Find matching container from stats
            const statsContainer = containers.find(c => c.fullName === fullContainerName)
            
            return {
              id: containerId.substring(0, 12),
              name: shortName,
              fullName: fullContainerName,
              status,
              image,
              created: new Date(created).toISOString(),
              restartCount: parseInt(restartCount),
              memory: statsContainer?.memory || { used: 0, limit: 0, percent: 0 },
              cpu: statsContainer?.cpu || 0,
              network: statsContainer?.network || 'N/A',
              blockIO: statsContainer?.blockIO || 'N/A'
            }
          } catch (err) {
            console.error(`Error inspecting container ${containerName}:`, err)
            return null
          }
        })
      )

      // Filter out null results
      const validContainers = detailedContainers.filter((c): c is DetailedContainer => c !== null)

      // Get volume information
      interface VolumeInfo {
        name: string
        fullName: string
        driver: string
        size: string
        sizeBytes: number
      }

      let volumes: VolumeInfo[] = []
      try {
        const { stdout: volumeOutput } = await execAsync(
          `docker volume ls --filter "name=${project.slug}" --format "{{.Name}}|{{.Driver}}"`
        )
        
        volumes = await Promise.all(
          volumeOutput.trim().split('\n').filter(line => line).map(async (line): Promise<VolumeInfo> => {
            const [volumeName, driver] = line.split('|')
            
            try {
              // Try to get volume size from docker system df -v table exactly matching the name
              const { stdout: sizeOutput } = await execAsync(
                `docker system df -v | awk -v vol="${volumeName}" '$1==vol {print $3}'`
              ).catch(() => ({ stdout: 'N/A' }))

              const sizeStr = (sizeOutput || '').trim() || 'N/A'
              const sizeBytes = parseSizeToBytes(sizeStr)
              
              return {
                name: volumeName.replace(`${project.slug}_`, ''),
                fullName: volumeName,
                driver,
                size: sizeStr,
                sizeBytes
              }
            } catch {
              return {
                name: volumeName.replace(`${project.slug}_`, ''),
                fullName: volumeName,
                driver,
                size: 'N/A',
                sizeBytes: 0
              }
            }
          })
        )
      } catch (err) {
        console.error('Error getting volumes:', err)
      }

      // Get project volumes directory size
      let projectVolumesDirSize = 0
      let projectVolumesDirSizeFormatted = '0 B'
      try {
        const volumesPath = `supabase-projects/${project.slug}/docker/volumes`
        const { stdout: duOutput } = await execAsync(
          `du -sb "${volumesPath}" 2>/dev/null | awk '{print $1}'`
        ).catch(() => ({ stdout: '0' }))
        
        projectVolumesDirSize = parseInt(duOutput.trim() || '0', 10)
        projectVolumesDirSizeFormatted = formatBytes(projectVolumesDirSize)
      } catch (err) {
        console.error('Error measuring volumes directory size:', err)
      }

      // Get network information
      interface NetworkInfo {
        name: string
        fullName: string
        driver: string
        scope: string
      }

      let networks: NetworkInfo[] = []
      try {
        const { stdout: networkOutput } = await execAsync(
          `docker network ls --filter "name=${project.slug}" --format "{{.Name}}|{{.Driver}}|{{.Scope}}"`
        )
        
        networks = networkOutput.trim().split('\n').filter(line => line).map(line => {
          const [networkName, driver, scope] = line.split('|')
          return {
            name: networkName.replace(`${project.slug}_`, ''),
            fullName: networkName,
            driver,
            scope
          }
        })
      } catch (err) {
        console.error('Error getting networks:', err)
      }

      // Calculate statistics
      const totalVolumeSizeBytes = volumes.reduce((sum, v) => sum + (v.sizeBytes || 0), 0)
      
      // Get system total memory from host
      let systemTotalMemoryMB = 0
      try {
        const useHostMemory = process.env.USE_HOST_MEMORY === 'true'
        if (useHostMemory) {
          const meminfo = await readFile('/host/meminfo', 'utf-8')
          const totalMatch = meminfo.match(/MemTotal:\s+(\d+)\s+kB/)
          if (totalMatch) {
            systemTotalMemoryMB = Math.round(parseInt(totalMatch[1]) / 1024)
          }
        }
        
        // Fallback to free command if host memory not available
        if (systemTotalMemoryMB === 0) {
          const { stdout } = await execAsync('free -m')
          const lines = stdout.trim().split('\n')
          const memLine = lines[1].split(/\s+/)
          systemTotalMemoryMB = parseInt(memLine[1])
        }
      } catch (error) {
        console.error('Error getting system memory:', error)
        // Fallback to totalMemoryLimit if system memory unavailable
        systemTotalMemoryMB = totalMemoryLimitMB
      }
      
      const stats = {
        totalContainers: validContainers.length,
        runningContainers: validContainers.filter(c => c.status === 'running').length,
        stoppedContainers: validContainers.filter(c => c.status !== 'running').length,
        totalRestarts: validContainers.reduce((sum, c) => sum + c.restartCount, 0),
        totalMemoryUsed: Math.round(totalMemoryUsedMB),
        totalMemoryLimit: Math.round(totalMemoryLimitMB),
        systemTotalMemory: systemTotalMemoryMB,
        memoryUsagePercent: systemTotalMemoryMB > 0 ? Math.round((totalMemoryUsedMB / systemTotalMemoryMB) * 100) : 0,
        averageCpu: validContainers.length > 0 
          ? Math.round(validContainers.reduce((sum, c) => sum + c.cpu, 0) / validContainers.length * 100) / 100 
          : 0,
        totalVolumes: volumes.length,
        totalVolumeSizeBytes: projectVolumesDirSize,
        totalVolumeSize: projectVolumesDirSizeFormatted,
        totalNetworks: networks.length
      }

      return NextResponse.json({
        projectId,
        projectName: project.name,
        projectSlug: project.slug,
        timestamp: new Date().toISOString(),
        stats,
        containers: validContainers,
        volumes,
        networks
      })
    } catch (error) {
      console.error('Project analysis error:', error)
      
            // Return empty analysis if no containers are running
      return NextResponse.json({
        projectId,
        projectName: project.name,
        projectSlug: project.slug,
        timestamp: new Date().toISOString(),
        stats: {
          totalContainers: 0,
          runningContainers: 0,
          stoppedContainers: 0,
          totalRestarts: 0,
          totalMemoryUsed: 0,
          totalMemoryLimit: 0,
          systemTotalMemory: 0,
          memoryUsagePercent: 0,
          averageCpu: 0,
          totalVolumes: 0,
          totalVolumeSizeBytes: 0,
          totalVolumeSize: '0 B',
          totalNetworks: 0
        },
        containers: [],
        volumes: [],
        networks: []
      })
    }
  } catch (error) {
    console.error('Project memory analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze project memory' },
      { status: 500 }
    )
  }
}
