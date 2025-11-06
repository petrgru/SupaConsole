'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ContainerStats {
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

interface VolumeInfo {
  name: string
  fullName: string
  driver: string
  size: string
}

interface NetworkInfo {
  name: string
  fullName: string
  driver: string
  scope: string
}

interface ProjectAnalysis {
  projectId: string
  projectName: string
  projectSlug: string
  timestamp: string
  stats: {
    totalContainers: number
    runningContainers: number
    stoppedContainers: number
    totalRestarts: number
    totalMemoryUsed: number
    totalMemoryLimit: number
    systemTotalMemory: number
    memoryUsagePercent: number
    averageCpu: number
    totalVolumes: number
    totalVolumeSizeBytes: number
    totalVolumeSize: string
    totalNetworks: number
  }
  containers: ContainerStats[]
  volumes: VolumeInfo[]
  networks: NetworkInfo[]
}

export default function ProjectMemoryPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchAnalysis = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/memory/analyze`)
      if (!response.ok) {
        throw new Error('Failed to fetch memory analysis')
      }
      const data = await response.json()
      setAnalysis(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalysis()
  }, [projectId])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchAnalysis()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, projectId])

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(2)} GB`
    }
    return `${bytes} MB`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusColor = (status: string) => {
    return status === 'running' ? 'text-green-600' : 'text-gray-600'
  }

  const getMemoryColor = (percent: number) => {
    if (percent > 80) return 'text-red-600'
    if (percent > 60) return 'text-yellow-600'
    return 'text-green-600'
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading memory analysis...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!analysis) {
    return null
  }

  const topMemoryContainers = [...analysis.containers]
    .sort((a, b) => b.memory.used - a.memory.used)
    .slice(0, 5)

  const topCpuContainers = [...analysis.containers]
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 5)

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Memory Analysis</h1>
          <p className="text-muted-foreground">
            {analysis.projectName} ({analysis.projectSlug})
          </p>
          <p className="text-sm text-muted-foreground">
            Last updated: {formatDate(analysis.timestamp)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
          </Button>
          <Button onClick={fetchAnalysis} variant="outline">
            🔄 Refresh Now
          </Button>
          <Button onClick={() => router.back()} variant="outline">
            ← Back
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Memory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(analysis.stats.totalMemoryUsed)}</div>
            <p className="text-xs text-muted-foreground">
              of {formatBytes(analysis.stats.systemTotalMemory)} system
            </p>
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    analysis.stats.memoryUsagePercent > 80 ? 'bg-red-500' :
                    analysis.stats.memoryUsagePercent > 60 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${analysis.stats.memoryUsagePercent}%` }}
                ></div>
              </div>
              <p className="text-xs text-right mt-1">{analysis.stats.memoryUsagePercent}%</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Containers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.stats.totalContainers}</div>
            <p className="text-xs text-muted-foreground">
              {analysis.stats.runningContainers} running, {analysis.stats.stoppedContainers} stopped
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average CPU</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.stats.averageCpu.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">Across all containers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Volumes Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.stats.totalVolumeSize}</div>
            <p className="text-xs text-muted-foreground">
              {analysis.stats.totalVolumes} volume{analysis.stats.totalVolumes !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Restarts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.stats.totalRestarts}</div>
            <p className="text-xs text-muted-foreground">Total container restarts</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Consumers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>🔥 Top Memory Consumers</CardTitle>
            <CardDescription>Containers using the most memory</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topMemoryContainers.map((container) => (
                <div key={container.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{container.name}</div>
                    <div className="text-sm text-muted-foreground">{container.image}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${getMemoryColor(container.memory.percent)}`}>
                      {formatBytes(container.memory.used)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {container.memory.percent.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>⚡ Top CPU Consumers</CardTitle>
            <CardDescription>Containers using the most CPU</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCpuContainers.map((container) => (
                <div key={container.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{container.name}</div>
                    <div className="text-sm text-muted-foreground">{container.image}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">
                      {container.cpu.toFixed(2)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      CPU usage
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Containers */}
      <Card>
        <CardHeader>
          <CardTitle>📦 All Containers ({analysis.containers.length})</CardTitle>
          <CardDescription>Detailed view of all project containers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analysis.containers.map((container) => (
              <div key={container.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-lg">{container.name}</div>
                    <div className="text-sm text-muted-foreground">{container.image}</div>
                    <div className="text-xs text-muted-foreground">ID: {container.id}</div>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(container.status)}`}>
                      {container.status}
                    </span>
                    {container.restartCount > 0 && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                        {container.restartCount} restarts
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Memory</div>
                    <div className={`font-medium ${getMemoryColor(container.memory.percent)}`}>
                      {formatBytes(container.memory.used)} / {formatBytes(container.memory.limit)}
                    </div>
                    <div className="text-xs text-muted-foreground">{container.memory.percent.toFixed(1)}%</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-muted-foreground">CPU</div>
                    <div className="font-medium">{container.cpu.toFixed(2)}%</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-muted-foreground">Network I/O</div>
                    <div className="font-medium text-xs">{container.network}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-muted-foreground">Block I/O</div>
                    <div className="font-medium text-xs">{container.blockIO}</div>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground mt-2">
                  Created: {formatDate(container.created)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Volumes & Networks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>💾 Volumes ({analysis.volumes.length})</CardTitle>
            <CardDescription>Docker volumes for this project</CardDescription>
          </CardHeader>
          <CardContent>
            {analysis.volumes.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No volumes found</p>
            ) : (
              <div className="space-y-2">
                {analysis.volumes.map((volume) => (
                  <div key={volume.fullName} className="border rounded p-3">
                    <div className="font-medium">{volume.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Driver: {volume.driver} • Size: {volume.size}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🌐 Networks ({analysis.networks.length})</CardTitle>
            <CardDescription>Docker networks for this project</CardDescription>
          </CardHeader>
          <CardContent>
            {analysis.networks.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No networks found</p>
            ) : (
              <div className="space-y-2">
                {analysis.networks.map((network) => (
                  <div key={network.fullName} className="border rounded p-3">
                    <div className="font-medium">{network.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Driver: {network.driver} • Scope: {network.scope}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
