import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client.js';

/**
 * Thin NestJS lifecycle wrapper around the generated Prisma client. This is
 * only a connection boundary: no query, retrieval or business logic lives
 * here. Not imported by AppModule yet (see docs/database/README.md) so that
 * `npm run build` / `npm test` keep working without a running database.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString)
      throw new Error('DATABASE_URL is not set (see .env.example).');
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
