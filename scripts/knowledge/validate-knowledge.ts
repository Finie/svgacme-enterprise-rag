import { createPrismaClient } from '../database/lib/client.js';
import { config } from './chunking.js';
import { validateKnowledge } from './pipeline.js';
const prisma = createPrismaClient();
try {
  console.log(
    JSON.stringify(await validateKnowledge(prisma, config()), null, 2),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
