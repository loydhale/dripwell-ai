import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  const hash = '$2b$10$E1kClnHSw6gVgGQogO2KUOg4yBQyGXzcbGwuDoon91g9qob4kXFDq';
  
  await prisma.user.updateMany({
    where: {
      email: {
        in: ['vendor@dripwell.ai', 'super@test.com', 'provider@test.com']
      }
    },
    data: {
      passwordHash: hash
    }
  });
  
  console.log('Passwords updated successfully.');
  console.log('Login with any of these accounts:');
  console.log('- vendor@dripwell.ai / TestPass123!');
  console.log('- super@test.com / TestPass123!');
  console.log('- provider@test.com / TestPass123!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
