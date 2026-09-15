import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { PoliciesController } from './policies.controller.js';
import { PoliciesService } from './policies.service.js';
@Module({
  imports: [DatabaseModule],
  controllers: [PoliciesController],
  providers: [PoliciesService],
})
export class PoliciesModule {}
