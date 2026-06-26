import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.users.findFirst({ where: { email: 'comercial.admin2@run.com' } });
  console.log(user);
}
main().catch(console.error).finally(() => prisma.$disconnect());
