'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Project {
  id: string
  name: string
  slug: string
  description?: string
  status: string
  createdAt: string
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [initProgress, setInitProgress] = useState('')
  const [error, setError] = useState('')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectUrls, setProjectUrls] = useState<Record<string, string>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [systemMemory, setSystemMemory] = useState<{ total: number; used: number; usedPercent: number } | null>(null)
  const [projectStats, setProjectStats] = useState<Record<string, {
    totalMemoryUsed: number
    systemTotalMemory: number
    memoryUsagePercent: number
    averageCpu: number
    totalContainers: number
    runningContainers: number
    totalVolumeSize: string
  }>>({})
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [updatingRegistration, setUpdatingRegistration] = useState(false)
  const router = useRouter()

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
         console.log('Fetched projects:', data.projects.length)
        setProjects(data.projects)
        if (data.projects.length > 0) {
          setInitialized(true)
        }
      } else if (response.status === 401) {
        router.push('/auth/login')
        return
      }
    } catch {
      setError('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const handleInitialize = async () => {
    setInitializing(true)
    setError('')
    setInitProgress('Starting initialization...')

    try {
      setInitProgress('Creating directories...')
      await new Promise(resolve => setTimeout(resolve, 500)) // Small delay for UX
      
      setInitProgress('Cloning Supabase repository (this may take a few minutes)...')
      const response = await fetch('/api/projects/initialize', {
        method: 'POST',
      })

      if (response.ok) {
        setInitProgress('Repository cloned successfully!')
        await new Promise(resolve => setTimeout(resolve, 1000))
        setInitialized(true)
        setInitProgress('')
      } else {
        const data = await response.json()
        setError(data.error || 'Initialization failed')
        setInitProgress('')
      }
    } catch {
      setError('An error occurred during initialization')
      setInitProgress('')
    } finally {
      setInitializing(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/auth/login')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const handleCreateProject = () => {
    router.push('/dashboard/create-project')
  }

  const handleManageProject = async (project: Project) => {
    setSelectedProject(project)
    
    // Fetch project URLs from environment variables
    try {
      const response = await fetch(`/api/projects/${project.id}/env`)
      if (response.ok) {
        const data = await response.json()
        const envVars = data.envVars || {}
        
        // Extract URLs from environment variables
        const urls: Record<string, string> = {}
        if (envVars.KONG_HTTP_PORT) {
          urls['API Gateway'] = `http://localhost:${envVars.KONG_HTTP_PORT}`
        }
        if (envVars.STUDIO_PORT) {
          urls['Supabase Studio'] = `http://localhost:${envVars.KONG_HTTP_PORT || 8000}`
        }
        if (envVars.ANALYTICS_PORT) {
          urls['Analytics (Logflare)'] = `http://localhost:${envVars.ANALYTICS_PORT}`
        }
        if (envVars.POSTGRES_PORT) {
          urls['Database'] = `postgresql://postgres:${envVars.POSTGRES_PASSWORD || 'password'}@localhost:${envVars.POSTGRES_PORT}/postgres`
        }
        
        setProjectUrls(urls)
      }
    } catch (error) {
      console.error('Failed to fetch project URLs:', error)
    }
  }

  const handleDeleteProject = async () => {
    if (!selectedProject) return
    
    setDeleting(true)
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remove project from local state
        setProjects(prev => prev.filter(p => p.id !== selectedProject.id))
        setSelectedProject(null)
        setShowDeleteConfirm(false)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete project')
      }
    } catch (error) {
      setError('Failed to delete project')
      console.error('Delete project error:', error)
    } finally {
      setDeleting(false)
    }
  }

  const closeModal = () => {
    setSelectedProject(null)
    setShowDeleteConfirm(false)
    setProjectUrls({})
  }

  const fetchSystemMemory = async () => {
    try {
      const response = await fetch('/api/system/memory')
      if (response.ok) {
        const data = await response.json()
        setSystemMemory(data)
      }
    } catch (error) {
      console.error('Failed to fetch system memory:', error)
    }
  }

  const fetchRegistrationStatus = async () => {
    try {
      const response = await fetch('/api/settings/registration')
      if (response.ok) {
        const data = await response.json()
        setRegistrationOpen(data.registrationOpen)
      }
    } catch (error) {
      console.error('Failed to fetch registration status:', error)
    }
  }

  const toggleRegistration = async () => {
    setUpdatingRegistration(true)
    try {
      const response = await fetch('/api/settings/registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registrationOpen: !registrationOpen
        })
      })

      if (response.ok) {
        const data = await response.json()
        setRegistrationOpen(data.registrationOpen)
      }
    } catch (error) {
      console.error('Failed to toggle registration:', error)
    } finally {
      setUpdatingRegistration(false)
    }
  }

  const fetchProjectMemory = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/memory/analyze`)
      if (response.ok) {
        const data = await response.json()
        console.log('Project stats for', projectId, ':', data.stats)
        setProjectStats(prev => ({ 
          ...prev, 
          [projectId]: {
            totalMemoryUsed: data.stats.totalMemoryUsed,
            systemTotalMemory: data.stats.systemTotalMemory,
            memoryUsagePercent: data.stats.memoryUsagePercent,
            averageCpu: data.stats.averageCpu,
            totalContainers: data.stats.totalContainers,
            runningContainers: data.stats.runningContainers,
            totalVolumeSize: data.stats.totalVolumeSize
          }
        }))
      } else {
        console.error('Failed to fetch project stats, status:', response.status)
      }
    } catch (error) {
      console.error('Failed to fetch project stats:', error)
    }
  }

  useEffect(() => {
    fetchProjects()
    fetchRegistrationStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (projects.length > 0) {
      // Fetch stats immediately
      fetchSystemMemory()
      projects.forEach(project => {
        fetchProjectMemory(project.id)
      })
      
      // Refresh memory info every 5 minutes (300000ms)
      const interval = setInterval(() => {
        fetchSystemMemory()
         // Re-fetch projects to get latest list
         fetch('/api/projects')
           .then(res => res.json())
           .then(data => {
             data.projects.forEach((project: Project) => {
               fetchProjectMemory(project.id)
             })
           })
           .catch(err => console.error('Failed to refresh project stats:', err))
      }, 300000)
      
      return () => clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [projects])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Image 
              src="/logo.png" 
              alt="SupaConsole" 
              width={150} 
              height={150}
              className="object-contain"
            />
            {/* Registration Lock Toggle */}
            <button
              onClick={toggleRegistration}
              disabled={updatingRegistration}
              className="ml-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors relative group"
              title={registrationOpen ? "Registration is open - click to close" : "Registration is closed - click to open"}
            >
              {updatingRegistration ? (
                <svg className="w-5 h-5 animate-spin text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : registrationOpen ? (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
              
              {/* Tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {registrationOpen ? "Close registration for new users" : "Registration closed for new users"}
                <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-gray-900 rotate-45"></div>
              </div>
            </button>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!initialized && projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Welcome to SupaConsole</CardTitle>
                <CardDescription>
                  Initialize your workspace to get started with managing Supabase projects
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded mb-4">
                    {error}
                  </div>
                )}
                
                {initProgress && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-blue-500 mb-2">
                      <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                      <span className="text-sm">{initProgress}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{width: '45%'}}></div>
                    </div>
                  </div>
                )}
                
                <Button 
                  onClick={handleInitialize} 
                  disabled={initializing}
                  className="w-full"
                >
                  {initializing ? 'Initializing...' : 'Initialize'}
                </Button>
                
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  This will clone the Supabase repository (~500MB) and set up the workspace
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold">Projects</h2>
                <p className="text-muted-foreground">Manage your Supabase projects</p>
              </div>
              <Button onClick={handleCreateProject}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Project
              </Button>
            </div>

            {/* System Memory Info */}
            {systemMemory && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                    System Memory Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Used: {systemMemory.used} MB / {systemMemory.total} MB</span>
                      <span className={`font-semibold ${
                        systemMemory.usedPercent > 80 ? 'text-red-500' : 
                        systemMemory.usedPercent > 60 ? 'text-yellow-500' : 
                        'text-green-500'
                      }`}>
                        {systemMemory.usedPercent}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all ${
                          systemMemory.usedPercent > 80 ? 'bg-red-500' : 
                          systemMemory.usedPercent > 60 ? 'bg-yellow-500' : 
                          'bg-green-500'
                        }`}
                        style={{ width: `${systemMemory.usedPercent}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {projects.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <h3 className="text-lg font-medium mb-2">No projects yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first project to get started
                  </p>
                  <Button onClick={handleCreateProject}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Project
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <Card key={project.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start">
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                      </div>
                      {project.description && (
                        <CardDescription>{project.description}</CardDescription>
                      )}
                      {/* Single status+metrics row under project name */}
                      {projectStats[project.id] ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          {/* Health status computed from containers */}
                          {(() => {
                            const s = projectStats[project.id]
                            const healthy = s.runningContainers === s.totalContainers && s.totalContainers > 0
                            const degraded = !healthy && s.runningContainers > 0
                            const statusLabel = healthy ? 'Healthy' : degraded ? 'Degraded' : 'Down'
                            const statusClass = healthy
                              ? 'bg-green-100 text-green-800'
                              : degraded
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            return (
                              <span className={`px-2 py-1 rounded-full ${statusClass}`}>{statusLabel}</span>
                            )
                          })()}

                          {/* Containers count */}
                          <span className="px-2 py-1 rounded bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                            Containers: {projectStats[project.id].runningContainers}/{projectStats[project.id].totalContainers}
                          </span>

                          {/* Memory */}
                          <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 flex items-center gap-1" title="Memory Usage">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                            RAM: {Math.round(projectStats[project.id].totalMemoryUsed)} / {Math.round(projectStats[project.id].systemTotalMemory)} MB ({projectStats[project.id].memoryUsagePercent}%)
                          </span>

                          {/* CPU */}
                          <span className="px-2 py-1 rounded bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 flex items-center gap-1" title="Average CPU">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            CPU: {projectStats[project.id].averageCpu.toFixed(1)}%
                          </span>

                          {/* Volumes Size */}
                          <span className="px-2 py-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 flex items-center gap-1" title="Volumes Directory Size">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            Volumes: {projectStats[project.id].totalVolumeSize}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Loading stats…</div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleManageProject(project)} className="flex-1">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Manage
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => router.push(`/dashboard/projects/${project.id}/memory`)}
                            className="flex-1"
                            title="View detailed memory analysis"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Analysis
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Project Management Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Manage Project</h3>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">{selectedProject.name}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{selectedProject.description}</p>
                
                {/* Project URLs */}
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Service URLs:</h5>
                  {Object.entries(projectUrls).map(([name, url]) => (
                    <div key={name} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{name}:</span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-mono truncate max-w-xs"
                        title={url}
                      >
                        {url}
                        <svg className="w-3 h-3 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  ))}
                  {Object.keys(projectUrls).length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No active services found</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/projects/${selectedProject.id}/configure`)}
                  className="flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Configure
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/projects/${selectedProject.id}/memory`)}
                  className="flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  Memory
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="col-span-2 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Project</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  Are you sure you want to delete <strong>{selectedProject.name}</strong>?
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This will:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 mt-1 ml-4 list-disc">
                  <li>Stop all running Docker containers</li>
                  <li>Remove all project files and data</li>
                  <li>Delete the project from the database</li>
                </ul>
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1"
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteProject}
                  className="flex-1"
                  disabled={deleting}
                >
                  {deleting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Deleting...
                    </div>
                  ) : (
                    'Delete Project'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}