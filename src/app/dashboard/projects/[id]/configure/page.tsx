'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ConfigureProjectPage() {
  const routeParams = useParams<{ id: string }>()
  const [envVars, setEnvVars] = useState({
    // Secrets
    POSTGRES_PASSWORD: 'your-super-secret-and-long-postgres-password',
    JWT_SECRET: 'your-super-secret-jwt-token-with-at-least-32-characters-long',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
    SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q',
    DASHBOARD_USERNAME: 'supabase',
    DASHBOARD_PASSWORD: 'this_password_is_insecure_and_should_be_updated',
    SECRET_KEY_BASE: 'UpNVntn3cDxHJpq99YMc1T1AQgQpc8kfYTuRgBiYa15BLrx8etQoXz3gZv1/u2oq',
    VAULT_ENC_KEY: 'your-encryption-key-32-chars-min',
    
    // Database
    POSTGRES_HOST: 'db',
    POSTGRES_DB: 'postgres',
    POSTGRES_PORT: '5432',
    
    // Supavisor
    POOLER_PROXY_PORT_TRANSACTION: '6543',
    POOLER_DEFAULT_POOL_SIZE: '20',
    POOLER_MAX_CLIENT_CONN: '100',
    POOLER_TENANT_ID: 'your-tenant-id',
    POOLER_DB_POOL_SIZE: '5',
    
    // Kong
    KONG_HTTP_PORT: '8000',
    KONG_HTTPS_PORT: '8443',
    
    // Analytics
    ANALYTICS_PORT: '4000',
    
    // PostgREST
    PGRST_DB_SCHEMAS: 'public,storage,graphql_public',
    
    // Auth
    SITE_URL: 'http://localhost:3000',
    ADDITIONAL_REDIRECT_URLS: '',
    JWT_EXPIRY: '3600',
    DISABLE_SIGNUP: 'false',
    API_EXTERNAL_URL: 'http://localhost:8000',
    
    // Mailer
    MAILER_URLPATHS_CONFIRMATION: '/auth/v1/verify',
    MAILER_URLPATHS_INVITE: '/auth/v1/verify',
    MAILER_URLPATHS_RECOVERY: '/auth/v1/verify',
    MAILER_URLPATHS_EMAIL_CHANGE: '/auth/v1/verify',
    
    // Email auth
    ENABLE_EMAIL_SIGNUP: 'true',
    ENABLE_EMAIL_AUTOCONFIRM: 'false',
    SMTP_ADMIN_EMAIL: 'admin@example.com',
    SMTP_HOST: 'supabase-mail',
    SMTP_PORT: '2500',
    SMTP_USER: 'fake_mail_user',
    SMTP_PASS: 'fake_mail_password',
    SMTP_SENDER_NAME: 'fake_sender',
    ENABLE_ANONYMOUS_USERS: 'false',
    
    // Phone auth
    ENABLE_PHONE_SIGNUP: 'true',
    ENABLE_PHONE_AUTOCONFIRM: 'true',
    
    // Studio
    STUDIO_DEFAULT_ORGANIZATION: 'Default Organization',
    STUDIO_DEFAULT_PROJECT: 'Default Project',
    STUDIO_PORT: '3000',
    SUPABASE_PUBLIC_URL: 'http://localhost:8000',
    
    // ImgProxy
    IMGPROXY_ENABLE_WEBP_DETECTION: 'true',
    
    // OpenAI
    OPENAI_API_KEY: '',
    
    // Functions
    FUNCTIONS_VERIFY_JWT: 'false',
    
    // Logs
    LOGFLARE_PUBLIC_ACCESS_TOKEN: 'your-super-secret-and-long-logflare-key-public',
    LOGFLARE_PRIVATE_ACCESS_TOKEN: 'your-super-secret-and-long-logflare-key-private',
    DOCKER_SOCKET_LOCATION: '/var/run/docker.sock',
    
    // Google Cloud
    GOOGLE_PROJECT_ID: 'GOOGLE_PROJECT_ID',
    GOOGLE_PROJECT_NUMBER: 'GOOGLE_PROJECT_NUMBER'
  })
  const [loading, setLoading] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [statusContainers, setStatusContainers] = useState<Array<{ Name: string; State: string; Health?: string | null }>>([])
  const [restarting, setRestarting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [projectId, setProjectId] = useState<string>('')
  const [systemChecks, setSystemChecks] = useState<{
    docker: boolean;
    dockerCompose: boolean;
    dockerRunning: boolean;
    internetConnection: boolean;
  } | null>(null)
  const [checkingSystem, setCheckingSystem] = useState(false)
  const [hiddenKeys, setHiddenKeys] = useState<Record<string, boolean>>({})

  // Keys considered sensitive (will be hidden by default)
  const sensitiveRegex = /password|secret|key|token|pass|private/i

  useEffect(() => {
    // initialize hidden state for any envVar keys that look sensitive
    const init: Record<string, boolean> = { ...hiddenKeys }
    Object.keys(envVars).forEach(k => {
      if (sensitiveRegex.test(k) && init[k] === undefined) init[k] = true
    })
    setHiddenKeys(init)
  }, [projectId, envVars])

  const toggleHidden = (key: string) => {
    setHiddenKeys(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const revealAllInSection = (keys: string[]) => {
    setHiddenKeys(prev => {
      const updated = { ...prev }
      keys.forEach(k => { updated[k] = false })
      return updated
    })
  }

  const hideAllInSection = (keys: string[]) => {
    setHiddenKeys(prev => {
      const updated = { ...prev }
      keys.forEach(k => { updated[k] = true })
      return updated
    })
  }
  // Note: router not needed on this page currently
  
  useEffect(() => {
    const id = (routeParams?.id ?? '').toString()
    setProjectId(id)
  }, [routeParams])

  // Load existing environment variables when projectId is available
  useEffect(() => {
    if (!projectId) return

    const loadEnvVars = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/env`)
        if (response.ok) {
          const data = await response.json()
          if (data.envVars && Object.keys(data.envVars).length > 0) {
            // Update state with existing environment variables
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setEnvVars((prev: any) => ({
              ...prev,
              ...data.envVars
            }))
          }
        }
      } catch (error) {
        console.error('Failed to load environment variables:', error)
      }
    }

    loadEnvVars()
  }, [projectId])

  const generateSecureKey = (length: number = 32) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const handleGenerateSecrets = () => {
    const jwtSecret = generateSecureKey(64)
    const projectId = `project-${Date.now()}`
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setEnvVars((prev: any) => ({
      ...prev,
      POSTGRES_PASSWORD: generateSecureKey(32),
      JWT_SECRET: jwtSecret,
      ANON_KEY: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({
        role: 'anon',
        iss: 'supabase',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
      }))}.${generateSecureKey(43)}`,
      SERVICE_ROLE_KEY: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({
        role: 'service_role',
        iss: 'supabase',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
      }))}.${generateSecureKey(43)}`,
      DASHBOARD_PASSWORD: generateSecureKey(16),
      SECRET_KEY_BASE: generateSecureKey(64),
      VAULT_ENC_KEY: generateSecureKey(32),
      POOLER_TENANT_ID: projectId,
      LOGFLARE_PUBLIC_ACCESS_TOKEN: generateSecureKey(64),
      LOGFLARE_PRIVATE_ACCESS_TOKEN: generateSecureKey(64),
    }))
  }

  const handleInputChange = (key: string, value: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setEnvVars((prev: any) => ({
      ...prev,
      [key]: value
    }))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createInputHandler = (key: string) => (e: any) => {
    handleInputChange(key, e.target.value)
  }

  const handleSystemCheck = async () => {
    setCheckingSystem(true)
    setError('')
    
    try {
      const response = await fetch('/api/system/check')
      if (response.ok) {
        const data = await response.json()
        setSystemChecks(data.checks)
      } else {
        setError('Failed to check system prerequisites')
      }
    } catch {
      setError('Failed to check system prerequisites')
    } finally {
      setCheckingSystem(false)
    }
  }

  const handleSaveConfiguration = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/projects/${projectId}/env`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(envVars),
      })

      if (response.ok) {
        setSuccess('Configuration saved successfully!')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save configuration')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const pollUntilReady = async (timeoutMs = 180000, intervalMs = 3000) => {
    setWaiting(true)
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const resp = await fetch(`/api/projects/${projectId}/status`, { cache: 'no-store' })
        if (resp.ok) {
          const data = await resp.json()
          const containers = (data.containers || []) as Array<{ Name: string; State: string; Health?: string | null }>
          setStatusContainers(containers)
          if (containers.length > 0 && containers.every(c => c.State === 'running')) {
            setWaiting(false)
            return true
          }
        }
      } catch {
        // ignore and retry
      }
      await new Promise(r => setTimeout(r, intervalMs))
    }
    setWaiting(false)
    return false
  }

  const handleDeployProject = async () => {
    if (!projectId) {
      setError('Missing project id')
      return
    }
    setDeploying(true)
    setError('')

    try {
      const response = await fetch(`/api/projects/${projectId}/deploy`, {
        method: 'POST',
      })

      if (response.ok) {
        setSuccess('Deployment started. Waiting for containers to become ready...')
        const ready = await pollUntilReady()
        if (ready) {
          setSuccess('Project is up and running!')
        } else {
          setError('Containers did not become ready in time. You can check logs or try again.')
        }
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to deploy project')
      }
    } catch {
      setError('An error occurred during deployment.')
    } finally {
      setDeploying(false)
    }
  }

  const handleRestartProject = async () => {
    if (!projectId) {
      setError('Missing project id')
      return
    }
    setRestarting(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/projects/${projectId}/restart`, {
        method: 'POST',
      })

      if (response.ok) {
        setSuccess('Restart triggered. Waiting for containers to become ready...')
        const ready = await pollUntilReady(120000)
        if (ready) {
          setSuccess('Project restarted and is running!')
        } else {
          setError('Containers did not become ready after restart. Please check container logs.')
        }
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to restart project')
      }
    } catch {
      setError('An error occurred during restart.')
    } finally {
      setRestarting(false)
    }
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
          </div>
          <Link href="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Configure Project Environment</h2>
            <p className="text-muted-foreground">
              Configure all environment variables for your Supabase project. All fields are pre-filled with default values from the official Supabase template.
            </p>
          </div>

          {success && (
            <div className="mb-6 bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-3 rounded">
              {success}
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-500 px-4 py-3 rounded mb-6">
            <p className="text-sm">
              <strong>Important:</strong> The form below is pre-filled with default values from the Supabase configuration template. 
              You MUST change the default passwords, secrets, and keys before deploying to production for security reasons.
            </p>
          </div>

          <div className="space-y-6">
            {/* Secrets Section */}
            <Card>
              <CardHeader>
                <CardTitle>🔐 Secrets (Critical - Must Change for Production)</CardTitle>
                <CardDescription>
                  These are the most critical security settings. Generate new secure values for production use.
                </CardDescription>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleGenerateSecrets}
                    variant="outline"
                    type="button"
                  >
                    Generate New Secure Secrets
                  </Button>
                  <Button
                    onClick={() => revealAllInSection(['POSTGRES_PASSWORD', 'JWT_SECRET', 'DASHBOARD_PASSWORD', 'SECRET_KEY_BASE', 'VAULT_ENC_KEY'])}
                    variant="outline"
                    type="button"
                    size="sm"
                  >
                    Reveal All
                  </Button>
                  <Button
                    onClick={() => hideAllInSection(['POSTGRES_PASSWORD', 'JWT_SECRET', 'DASHBOARD_PASSWORD', 'SECRET_KEY_BASE', 'VAULT_ENC_KEY'])}
                    variant="outline"
                    type="button"
                    size="sm"
                  >
                    Hide All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postgres_password">PostgreSQL Password</Label>
                    <div className="flex items-center">
                      <Input
                        id="postgres_password"
                        type={hiddenKeys['POSTGRES_PASSWORD'] ? 'password' : 'text'}
                        value={envVars.POSTGRES_PASSWORD}
                        onChange={createInputHandler('POSTGRES_PASSWORD')}
                      />
                      <button
                        type="button"
                        className="ml-2 p-2 text-muted-foreground hover:text-foreground"
                        onClick={() => toggleHidden('POSTGRES_PASSWORD')}
                        title={hiddenKeys['POSTGRES_PASSWORD'] ? 'Show' : 'Hide'}
                      >
                        {hiddenKeys['POSTGRES_PASSWORD'] ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jwt_secret">JWT Secret</Label>
                    <div className="flex items-center">
                      <Input
                        id="jwt_secret"
                        type={hiddenKeys['JWT_SECRET'] ? 'password' : 'text'}
                        value={envVars.JWT_SECRET}
                        onChange={createInputHandler('JWT_SECRET')}
                      />
                      <button
                        type="button"
                        className="ml-2 p-2 text-muted-foreground hover:text-foreground"
                        onClick={() => toggleHidden('JWT_SECRET')}
                        title={hiddenKeys['JWT_SECRET'] ? 'Show' : 'Hide'}
                      >
                        {hiddenKeys['JWT_SECRET'] ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dashboard_username">Dashboard Username</Label>
                    <Input
                      id="dashboard_username"
                      type="text"
                      value={envVars.DASHBOARD_USERNAME}
                      onChange={createInputHandler('DASHBOARD_USERNAME')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dashboard_password">Dashboard Password</Label>
                    <div className="flex items-center">
                      <Input
                        id="dashboard_password"
                        type={hiddenKeys['DASHBOARD_PASSWORD'] ? 'password' : 'text'}
                        value={envVars.DASHBOARD_PASSWORD}
                        onChange={createInputHandler('DASHBOARD_PASSWORD')}
                      />
                      <button
                        type="button"
                        className="ml-2 p-2 text-muted-foreground hover:text-foreground"
                        onClick={() => toggleHidden('DASHBOARD_PASSWORD')}
                        title={hiddenKeys['DASHBOARD_PASSWORD'] ? 'Show' : 'Hide'}
                      >
                        {hiddenKeys['DASHBOARD_PASSWORD'] ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secret_key_base">Secret Key Base</Label>
                    <div className="flex items-center">
                      <Input
                        id="secret_key_base"
                        type={hiddenKeys['SECRET_KEY_BASE'] ? 'password' : 'text'}
                        value={envVars.SECRET_KEY_BASE}
                        onChange={createInputHandler('SECRET_KEY_BASE')}
                      />
                      <button
                        type="button"
                        className="ml-2 p-2 text-muted-foreground hover:text-foreground"
                        onClick={() => toggleHidden('SECRET_KEY_BASE')}
                        title={hiddenKeys['SECRET_KEY_BASE'] ? 'Show' : 'Hide'}
                      >
                        {hiddenKeys['SECRET_KEY_BASE'] ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vault_enc_key">Vault Encryption Key</Label>
                    <div className="flex items-center">
                      <Input
                        id="vault_enc_key"
                        type={hiddenKeys['VAULT_ENC_KEY'] ? 'password' : 'text'}
                        value={envVars.VAULT_ENC_KEY}
                        onChange={createInputHandler('VAULT_ENC_KEY')}
                      />
                      <button
                        type="button"
                        className="ml-2 p-2 text-muted-foreground hover:text-foreground"
                        onClick={() => toggleHidden('VAULT_ENC_KEY')}
                        title={hiddenKeys['VAULT_ENC_KEY'] ? 'Show' : 'Hide'}
                      >
                        {hiddenKeys['VAULT_ENC_KEY'] ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* JWT Keys Section */}
            <Card>
              <CardHeader>
                <CardTitle>🔑 JWT Keys</CardTitle>
                <CardDescription>
                  JSON Web Token keys for authentication. The default keys are for demo purposes only.
                </CardDescription>
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={() => revealAllInSection(['ANON_KEY', 'SERVICE_ROLE_KEY'])}
                    variant="outline"
                    type="button"
                    size="sm"
                  >
                    Reveal All
                  </Button>
                  <Button
                    onClick={() => hideAllInSection(['ANON_KEY', 'SERVICE_ROLE_KEY'])}
                    variant="outline"
                    type="button"
                    size="sm"
                  >
                    Hide All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="anon_key">Anonymous Key (Public)</Label>
                    <div className="flex items-center">
                      <Input
                        id="anon_key"
                        type={hiddenKeys['ANON_KEY'] ? 'password' : 'text'}
                        value={envVars.ANON_KEY}
                        onChange={createInputHandler('ANON_KEY')}
                      />
                      <button
                        type="button"
                        className="ml-2 p-2 text-muted-foreground hover:text-foreground"
                        onClick={() => toggleHidden('ANON_KEY')}
                        title={hiddenKeys['ANON_KEY'] ? 'Show' : 'Hide'}
                      >
                        {hiddenKeys['ANON_KEY'] ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="service_role_key">Service Role Key (Secret)</Label>
                    <div className="flex items-center">
                      <Input
                        id="service_role_key"
                        type={hiddenKeys['SERVICE_ROLE_KEY'] ? 'password' : 'text'}
                        value={envVars.SERVICE_ROLE_KEY}
                        onChange={createInputHandler('SERVICE_ROLE_KEY')}
                      />
                      <button
                        type="button"
                        className="ml-2 p-2 text-muted-foreground hover:text-foreground"
                        onClick={() => toggleHidden('SERVICE_ROLE_KEY')}
                        title={hiddenKeys['SERVICE_ROLE_KEY'] ? 'Show' : 'Hide'}
                      >
                        {hiddenKeys['SERVICE_ROLE_KEY'] ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Database Section */}
            <Card>
              <CardHeader>
                <CardTitle>🗄️ Database Configuration</CardTitle>
                <CardDescription>
                  PostgreSQL database connection settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postgres_host">PostgreSQL Host</Label>
                    <Input
                      id="postgres_host"
                      type="text"
                      value={envVars.POSTGRES_HOST}
                      onChange={createInputHandler('POSTGRES_HOST')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postgres_db">Database Name</Label>
                    <Input
                      id="postgres_db"
                      type="text"
                      value={envVars.POSTGRES_DB}
                      onChange={createInputHandler('POSTGRES_DB')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postgres_port">PostgreSQL Port</Label>
                    <Input
                      id="postgres_port"
                      type="text"
                      value={envVars.POSTGRES_PORT}
                      onChange={createInputHandler('POSTGRES_PORT')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Auth Settings Section */}
            <Card>
              <CardHeader>
                <CardTitle>🔐 Authentication Settings</CardTitle>
                <CardDescription>
                  Configure authentication behavior and URLs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="site_url">Site URL</Label>
                    <Input
                      id="site_url"
                      type="text"
                      value={envVars.SITE_URL}
                      onChange={createInputHandler('SITE_URL')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="api_external_url">API External URL</Label>
                    <Input
                      id="api_external_url"
                      type="text"
                      value={envVars.API_EXTERNAL_URL}
                      onChange={createInputHandler('API_EXTERNAL_URL')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jwt_expiry">JWT Expiry (seconds)</Label>
                    <Input
                      id="jwt_expiry"
                      type="text"
                      value={envVars.JWT_EXPIRY}
                      onChange={createInputHandler('JWT_EXPIRY')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="disable_signup">Disable Signup</Label>
                    <Input
                      id="disable_signup"
                      type="text"
                      value={envVars.DISABLE_SIGNUP}
                      onChange={createInputHandler('DISABLE_SIGNUP')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email Settings Section */}
            <Card>
              <CardHeader>
                <CardTitle>📧 Email Configuration</CardTitle>
                <CardDescription>
                  SMTP settings for authentication emails.
                </CardDescription>
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={() => revealAllInSection(['SMTP_PASS'])}
                    variant="outline"
                    type="button"
                    size="sm"
                  >
                    Reveal All
                  </Button>
                  <Button
                    onClick={() => hideAllInSection(['SMTP_PASS'])}
                    variant="outline"
                    type="button"
                    size="sm"
                  >
                    Hide All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp_admin_email">Admin Email</Label>
                    <Input
                      id="smtp_admin_email"
                      type="email"
                      value={envVars.SMTP_ADMIN_EMAIL}
                      onChange={createInputHandler('SMTP_ADMIN_EMAIL')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_host">SMTP Host</Label>
                    <Input
                      id="smtp_host"
                      type="text"
                      value={envVars.SMTP_HOST}
                      onChange={createInputHandler('SMTP_HOST')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_port">SMTP Port</Label>
                    <Input
                      id="smtp_port"
                      type="text"
                      value={envVars.SMTP_PORT}
                      onChange={createInputHandler('SMTP_PORT')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_user">SMTP User</Label>
                    <Input
                      id="smtp_user"
                      type="text"
                      value={envVars.SMTP_USER}
                      onChange={createInputHandler('SMTP_USER')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_pass">SMTP Password</Label>
                    <div className="flex items-center">
                      <Input
                        id="smtp_pass"
                        type={hiddenKeys['SMTP_PASS'] ? 'password' : 'text'}
                        value={envVars.SMTP_PASS}
                        onChange={createInputHandler('SMTP_PASS')}
                      />
                      <button
                        type="button"
                        className="ml-2 p-2 text-muted-foreground hover:text-foreground"
                        onClick={() => toggleHidden('SMTP_PASS')}
                        title={hiddenKeys['SMTP_PASS'] ? 'Show' : 'Hide'}
                      >
                        {hiddenKeys['SMTP_PASS'] ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_sender_name">SMTP Sender Name</Label>
                    <Input
                      id="smtp_sender_name"
                      type="text"
                      value={envVars.SMTP_SENDER_NAME}
                      onChange={createInputHandler('SMTP_SENDER_NAME')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Studio Settings Section */}
            <Card>
              <CardHeader>
                <CardTitle>🎨 Studio Configuration</CardTitle>
                <CardDescription>
                  Supabase Studio dashboard settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="studio_default_organization">Default Organization</Label>
                    <Input
                      id="studio_default_organization"
                      type="text"
                      value={envVars.STUDIO_DEFAULT_ORGANIZATION}
                      onChange={createInputHandler('STUDIO_DEFAULT_ORGANIZATION')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="studio_default_project">Default Project</Label>
                    <Input
                      id="studio_default_project"
                      type="text"
                      value={envVars.STUDIO_DEFAULT_PROJECT}
                      onChange={createInputHandler('STUDIO_DEFAULT_PROJECT')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="studio_port">Studio Port</Label>
                    <Input
                      id="studio_port"
                      type="text"
                      value={envVars.STUDIO_PORT}
                      onChange={createInputHandler('STUDIO_PORT')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supabase_public_url">Supabase Public URL</Label>
                    <Input
                      id="supabase_public_url"
                      type="text"
                      value={envVars.SUPABASE_PUBLIC_URL}
                      onChange={createInputHandler('SUPABASE_PUBLIC_URL')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Advanced Settings Section */}
            <Card>
              <CardHeader>
                <CardTitle>⚙️ Advanced Settings</CardTitle>
                <CardDescription>
                  Optional advanced configuration settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="openai_api_key">OpenAI API Key (Optional)</Label>
                    <Input
                      id="openai_api_key"
                      type="password"
                      placeholder="For SQL Editor Assistant"
                      value={envVars.OPENAI_API_KEY}
                      onChange={createInputHandler('OPENAI_API_KEY')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kong_http_port">Kong HTTP Port</Label>
                    <Input
                      id="kong_http_port"
                      type="text"
                      value={envVars.KONG_HTTP_PORT}
                      onChange={createInputHandler('KONG_HTTP_PORT')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="analytics_port">Analytics Port</Label>
                    <Input
                      id="analytics_port"
                      type="text"
                      value={envVars.ANALYTICS_PORT}
                      onChange={createInputHandler('ANALYTICS_PORT')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pgrst_db_schemas">PostgREST DB Schemas</Label>
                    <Input
                      id="pgrst_db_schemas"
                      type="text"
                      value={envVars.PGRST_DB_SCHEMAS}
                      onChange={createInputHandler('PGRST_DB_SCHEMAS')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="functions_verify_jwt">Functions Verify JWT</Label>
                    <Input
                      id="functions_verify_jwt"
                      type="text"
                      value={envVars.FUNCTIONS_VERIFY_JWT}
                      onChange={createInputHandler('FUNCTIONS_VERIFY_JWT')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deployment</CardTitle>
                <CardDescription>
                  Save your configuration and deploy the Supabase instance with Docker
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <Button 
                      onClick={handleSaveConfiguration} 
                      disabled={loading}
                      variant="outline"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      {loading ? 'Saving...' : 'Save Configuration'}
                    </Button>
                    
                    <Button 
                      onClick={handleSystemCheck}
                      disabled={checkingSystem}
                      variant="secondary"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {checkingSystem ? 'Checking...' : 'Check System'}
                    </Button>
                    
                    <Button 
                      onClick={handleRestartProject}
                      disabled={restarting}
                      variant="outline"
                    >
                      {restarting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin"></div>
                          Restarting...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Restart Stack
                        </div>
                      )}
                    </Button>
                    
                    <Button 
                      onClick={handleDeployProject} 
                      disabled={deploying}
                    >
                      {deploying ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Deploying...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                          Deploy Project
                        </div>
                      )}
                    </Button>
                  </div>

                  {/* Live status/polling output */}
                  {(waiting || statusContainers.length > 0) && (
                    <div className="mt-4 bg-card border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Container status</h4>
                        {waiting && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin"></div>
                            Waiting for containers to be running…
                          </div>
                        )}
                      </div>
                      {statusContainers.length > 0 ? (
                        <div className="space-y-2 text-sm">
                          <div className="text-muted-foreground">
                            Running {statusContainers.filter((c: { State: string }) => c.State === 'running').length} / {statusContainers.length}
                          </div>
                          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {statusContainers.map((c: { Name: string; State: string; Health?: string | null }) => (
                              <li key={c.Name} className="flex items-center justify-between rounded border px-2 py-1">
                                <span className="font-mono truncate mr-2" title={c.Name}>{c.Name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${c.State === 'running' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                  {c.State}{c.Health ? ` (${c.Health})` : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No containers reported yet…</div>
                      )}
                    </div>
                  )}

                  {systemChecks && (
                    <div className="bg-card border rounded-lg p-4">
                      <h4 className="font-medium mb-2">System Prerequisites</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className={`flex items-center gap-2 ${systemChecks.docker ? 'text-green-600' : 'text-red-600'}`}>
                          <span>{systemChecks.docker ? '✅' : '❌'}</span>
                          Docker Installed
                        </div>
                        <div className={`flex items-center gap-2 ${systemChecks.dockerRunning ? 'text-green-600' : 'text-red-600'}`}>
                          <span>{systemChecks.dockerRunning ? '✅' : '❌'}</span>
                          Docker Running
                        </div>
                        <div className={`flex items-center gap-2 ${systemChecks.dockerCompose ? 'text-green-600' : 'text-red-600'}`}>
                          <span>{systemChecks.dockerCompose ? '✅' : '❌'}</span>
                          Docker Compose Available
                        </div>
                        <div className={`flex items-center gap-2 ${systemChecks.internetConnection ? 'text-green-600' : 'text-yellow-600'}`}>
                          <span>{systemChecks.internetConnection ? '✅' : '⚠️'}</span>
                          Internet Connection
                        </div>
                      </div>
                      {(!systemChecks.docker || !systemChecks.dockerRunning || !systemChecks.dockerCompose) && (
                        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 text-red-600 text-sm rounded">
                          Please install Docker Desktop and ensure it&apos;s running before deploying.
                        </div>
                      )}
                      {!systemChecks.internetConnection && (
                        <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 text-sm rounded">
                          No internet connection detected. Deployment will use cached Docker images if available.
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!success && (
                    <p className="text-sm text-muted-foreground">
                      Save configuration first before deploying
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}