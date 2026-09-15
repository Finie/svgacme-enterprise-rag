import { Controller, Get, Inject, Param } from '@nestjs/common';
import { PoliciesService } from './policies.service.js';
@Controller('policies')
export class PoliciesController {
  constructor(
    @Inject(PoliciesService) private readonly policies: PoliciesService,
  ) {}
  @Get(':id')
  find(@Param('id') id: string) {
    return this.policies.find(id);
  }
}
