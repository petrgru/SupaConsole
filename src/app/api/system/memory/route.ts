import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile } from 'fs/promises'

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session')?.value
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Try to get memory info from host /proc/meminfo if mounted
    const useHostMemory = process.env.USE_HOST_MEMORY === 'true'
    
    try {
      let total: number, used: number, free: number, available: number
      
      if (useHostMemory) {
        try {
          // Read from host's meminfo file (mounted from /tmp/host-meminfo.txt on host)
          const meminfo = await readFile('/host/meminfo', 'utf-8')
          const totalMatch = meminfo.match(/MemTotal:\s+(\d+)\s+kB/)
          const freeMatch = meminfo.match(/MemFree:\s+(\d+)\s+kB/)
          const availableMatch = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/)
          const buffersMatch = meminfo.match(/Buffers:\s+(\d+)\s+kB/)
          const cachedMatch = meminfo.match(/Cached:\s+(\d+)\s+kB/)
          
          if (totalMatch && freeMatch && availableMatch) {
            total = Math.round(parseInt(totalMatch[1]) / 1024) // kB to MB
            free = Math.round(parseInt(freeMatch[1]) / 1024)
            available = Math.round(parseInt(availableMatch[1]) / 1024)
            
            // Calculate used: total - available (not total - free)
            // This gives us the actual used memory including caches/buffers
            used = total - available
            
            const usedPercent = Math.round((used / total) * 100)

            return NextResponse.json({
              total,
              used,
              free,
              available,
              usedPercent,
              unit: 'MB'
            })
          }
        } catch (error) {
          console.error('Failed to read host meminfo:', error)
          // Fallback to free command
        }
      }
      
      // Fallback: use free command
      const { stdout } = await execAsync('free -m')
      const lines = stdout.trim().split('\n')
      const memLine = lines[1].split(/\s+/)
      
      total = parseInt(memLine[1])
      used = parseInt(memLine[2])
      free = parseInt(memLine[3])
      available = parseInt(memLine[6])
      
      const usedPercent = Math.round((used / total) * 100)

      return NextResponse.json({
        total,
        used,
        free,
        available,
        usedPercent,
        unit: 'MB'
      })
    } catch (error) {
      console.error('Memory check error:', error)
      return NextResponse.json(
        { error: 'Failed to get memory information' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Memory check error:', error)
    return NextResponse.json(
      { error: 'Failed to get memory information' },
      { status: 500 }
    )
  }
}
