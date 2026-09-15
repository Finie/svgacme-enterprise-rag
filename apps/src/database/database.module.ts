import { Global, Module } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service.js';

/**
 * Database boundary for the NestJS app: exposes PrismaService only. No RAG,
 * retrieval, embedding or business-agent logic belongs here — see
 * docs/database/README.md for what this phase intentionally excludes.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
