// Create a test user and session in the local SQLite DB and print the session token
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function main() {
  const prisma = new PrismaClient()
  const email = process.env.TEST_USER_EMAIL || 'tester@example.com'
  const password = process.env.TEST_USER_PASSWORD || 'Passw0rd!'
  const name = process.env.TEST_USER_NAME || 'Test User'

  const hashed = await bcrypt.hash(password, 12)

  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    user = await prisma.user.create({ data: { email, password: hashed, name } })
  }

  // Create session expiring in 24h
  const token = generateToken(32)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await prisma.session.create({ data: { userId: user.id, token, expiresAt } })

  console.log(JSON.stringify({ token, userId: user.id }))
  await prisma.$disconnect()
}

function generateToken(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

main().catch((e) => { console.error(e); process.exit(1) })
