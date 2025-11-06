import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function changePassword() {
  const email = 'petrgru@gmail.com'
  const newPassword = 'petrgru@gmail.com'
  
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    })
    
    if (!user) {
      console.error(`User with email ${email} not found`)
      process.exit(1)
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)
    
    // Update password
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    })
    
    console.log(`✅ Password successfully changed for user: ${email}`)
  } catch (error) {
    console.error('Error changing password:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

changePassword()
