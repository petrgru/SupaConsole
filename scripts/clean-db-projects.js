// Clean all project records from the SQLite database
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  
  const deletedEnvVars = await prisma.projectEnvVar.deleteMany({})
  console.log(`Deleted ${deletedEnvVars.count} project env vars`)
  
  const deletedProjects = await prisma.project.deleteMany({})
  console.log(`Deleted ${deletedProjects.count} projects`)
  
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
