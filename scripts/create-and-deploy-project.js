// Create a project, scaffold docker compose, generate env, and deploy the stack
const { PrismaClient } = require('@prisma/client')
const fs = require('fs/promises')
const path = require('path')
const { exec } = require('child_process')
const util = require('util')
const crypto = require('crypto')
const execAsync = util.promisify(exec)

async function main() {
  const prisma = new PrismaClient()
  const nameArg = process.argv[2] || 'test'
  const description = ''
  const timestamp = Date.now()
  const slug = `${nameArg.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}`

  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is required (e.g., file:/app/data/dev.db)')
    process.exit(1)
  }

  // Ensure owner user exists
  const email = 'tester@example.com'
  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    // Minimal user creation (password not needed for this script)
    user = await prisma.user.create({ data: { email, password: crypto.randomBytes(16).toString('hex'), name: 'Test User' } })
  }

  // Create project row
  const project = await prisma.project.create({ data: { name: nameArg, slug, description, ownerId: user.id } })

  // Paths
  const coreDockerDir = '/root/SupaConsole/supabase-core/docker'
  // Write files inside the container-mounted path
  const projectDir = path.join('/app/supabase-projects', slug)
  const dockerDir = path.join(projectDir, 'docker')
  // But run docker compose with HOST filesystem path so bind mounts resolve correctly
  const hostProjectsBase = process.env.HOST_PROJECT_PATH || '/root/SupaConsole/supabase-projects'
  const composeCwd = path.join(hostProjectsBase, slug, 'docker')

  // Copy docker template
  await fs.mkdir(projectDir, { recursive: true })
  await execAsync(`cp -r "${coreDockerDir}" "${projectDir}/"`)

  // Read and mutate compose
  const composeFile = path.join(dockerDir, 'docker-compose.yml')
  let compose = await fs.readFile(composeFile, 'utf8')

  // Unique name
  compose = compose.replace(/^name: supabase$/m, `name: ${slug}`)

  // Container names
  const containerMappings = [
    { original: 'supabase-studio', replacement: `${slug}-studio` },
    { original: 'supabase-kong', replacement: `${slug}-kong` },
    { original: 'supabase-auth', replacement: `${slug}-auth` },
    { original: 'supabase-rest', replacement: `${slug}-rest` },
    { original: 'realtime-dev.supabase-realtime', replacement: `realtime-dev.${slug}-realtime` },
    { original: 'supabase-storage', replacement: `${slug}-storage` },
    { original: 'supabase-imgproxy', replacement: `${slug}-imgproxy` },
    { original: 'supabase-meta', replacement: `${slug}-meta` },
    { original: 'supabase-edge-functions', replacement: `${slug}-edge-functions` },
    { original: 'supabase-analytics', replacement: `${slug}-analytics` },
    { original: 'supabase-db', replacement: `${slug}-db` },
    { original: 'supabase-vector', replacement: `${slug}-vector` },
    { original: 'supabase-pooler', replacement: `${slug}-pooler` }
  ]
  for (const m of containerMappings) {
    compose = compose.replace(new RegExp(`container_name: ${m.original}`, 'g'), `container_name: ${m.replacement}`)
  }

  // Analytics port configurable
  compose = compose.replace(/ports:\s*\n\s*-\s*4000:4000/m, 'ports:\n      - ${ANALYTICS_PORT}:4000')

  // Vector mounts: map whole directory and drop :z on docker.sock
  compose = compose
    .replace(/\.\/volumes\/logs\/vector\.yml:\/etc\/vector\/vector\.yml:ro,?z?/g, './volumes/logs:/etc/vector:ro')
    .replace(/\$\{DOCKER_SOCKET_LOCATION\}:\/var\/run\/docker\.sock:ro,?z?/g, '${DOCKER_SOCKET_LOCATION}:/var/run/docker.sock:ro')

  await fs.writeFile(composeFile, compose)

  // Generate env
  const basePort = 8000 + (timestamp % 10000)
  // Generate JWT secret first; sign tokens with HS256 using this secret
  const jwtSecret = randomString(64)
  const hostUrl = process.env.HOST_URL || `http://localhost`
  const env = {
    POSTGRES_PASSWORD: randomString(32),
    JWT_SECRET: jwtSecret,
    ANON_KEY: signJWT({ role: 'anon', iss: 'supabase', aud: 'authenticated', iat: Math.floor(timestamp/1000), exp: Math.floor(timestamp/1000) + 31536000 }, jwtSecret),
    SERVICE_ROLE_KEY: signJWT({ role: 'service_role', iss: 'supabase', aud: 'authenticated', iat: Math.floor(timestamp/1000), exp: Math.floor(timestamp/1000) + 31536000 }, jwtSecret),
    DASHBOARD_USERNAME: 'supabase',
    DASHBOARD_PASSWORD: randomString(16),
    SECRET_KEY_BASE: randomString(64),
    VAULT_ENC_KEY: randomString(32),
    PG_META_CRYPTO_KEY: randomString(32),
    POSTGRES_PORT: String(basePort + 2000),
    POOLER_PROXY_PORT_TRANSACTION: String(basePort + 3000),
    KONG_HTTP_PORT: String(basePort),
    KONG_HTTPS_PORT: String(basePort + 443),
    ANALYTICS_PORT: String(basePort + 1000),
    POSTGRES_HOST: 'db',
    POSTGRES_DB: 'postgres',
    POOLER_DEFAULT_POOL_SIZE: '20',
    POOLER_MAX_CLIENT_CONN: '100',
    POOLER_TENANT_ID: `project-${timestamp}`,
    POOLER_DB_POOL_SIZE: '5',
    PGRST_DB_SCHEMAS: 'public,storage,graphql_public',
  SITE_URL: `${hostUrl}:${basePort}`,
    ADDITIONAL_REDIRECT_URLS: '',
    JWT_EXPIRY: '3600',
    DISABLE_SIGNUP: 'false',
  API_EXTERNAL_URL: `${hostUrl}:${basePort}`,
    MAILER_URLPATHS_CONFIRMATION: '/auth/v1/verify',
    MAILER_URLPATHS_INVITE: '/auth/v1/verify',
    MAILER_URLPATHS_RECOVERY: '/auth/v1/verify',
    MAILER_URLPATHS_EMAIL_CHANGE: '/auth/v1/verify',
    ENABLE_EMAIL_SIGNUP: 'true',
    ENABLE_EMAIL_AUTOCONFIRM: 'false',
    SMTP_ADMIN_EMAIL: 'admin@example.com',
    SMTP_HOST: 'supabase-mail',
    SMTP_PORT: '2500',
    SMTP_USER: 'fake_mail_user',
    SMTP_PASS: 'fake_mail_password',
    SMTP_SENDER_NAME: 'fake_sender',
    ENABLE_ANONYMOUS_USERS: 'false',
    ENABLE_PHONE_SIGNUP: 'true',
    ENABLE_PHONE_AUTOCONFIRM: 'true',
    STUDIO_DEFAULT_ORGANIZATION: 'Default Organization',
    STUDIO_DEFAULT_PROJECT: 'Default Project',
  STUDIO_PORT: String(basePort + 100),
  SUPABASE_PUBLIC_URL: `${hostUrl}:${basePort}`,
    IMGPROXY_ENABLE_WEBP_DETECTION: 'true',
    OPENAI_API_KEY: '',
    FUNCTIONS_VERIFY_JWT: 'false',
    LOGFLARE_PUBLIC_ACCESS_TOKEN: randomString(64),
    LOGFLARE_PRIVATE_ACCESS_TOKEN: randomString(64),
    DOCKER_SOCKET_LOCATION: '/var/run/docker.sock',
    GOOGLE_PROJECT_ID: 'GOOGLE_PROJECT_ID',
    GOOGLE_PROJECT_NUMBER: 'GOOGLE_PROJECT_NUMBER'
  }

  const envPath = path.join(dockerDir, '.env')
  await fs.writeFile(envPath, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n'))

  // Store env vars to DB
  for (const [key, value] of Object.entries(env)) {
    await prisma.projectEnvVar.create({ data: { projectId: project.id, key, value } })
  }

  // Deploy with docker compose
  await execAsync('docker compose up -d --remove-orphans', { cwd: composeCwd })

  // Verify health (best-effort)
  try {
  const { stdout } = await execAsync('docker compose ps --format json', { cwd: composeCwd })
    const rows = `[${stdout.trim().split('\n').join(',')}]`
    const containers = JSON.parse(rows)
    const running = containers.filter(c => c.State === 'running')
    console.log(JSON.stringify({ projectId: project.id, slug, running: running.length }))
  } catch (e) {
    console.log(JSON.stringify({ projectId: project.id, slug, running: 0 }))
  }

  await prisma.$disconnect()
}

function randomString(len) { return crypto.randomBytes(Math.ceil(len / 2)).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, len) }
function base64url(input) { return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') }
function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerB64 = base64url(JSON.stringify(header))
  const payloadB64 = base64url(JSON.stringify(payload))
  const data = `${headerB64}.${payloadB64}`
  const sig = crypto.createHmac('sha256', secret).update(data).digest()
  const sigB64 = base64url(sig)
  return `${data}.${sigB64}`
}

main().catch((e) => { console.error(e); process.exit(1) })
