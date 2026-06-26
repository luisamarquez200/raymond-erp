import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.users.findUnique({
        where: { id: '5b74fb17-1981-4711-9611-d5a816cbf99b' },
        include: { roles: true }
    });
    console.log("User:", JSON.stringify(user, null, 2));

    const allUsers = await prisma.users.findMany();
    console.log("All users length:", allUsers.length);
    console.log("Users in DB:", allUsers.map(u => ({ id: u.id, email: u.email })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
