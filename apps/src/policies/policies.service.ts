import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
@Injectable()
export class PoliciesService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async find(id: string) {
    const policy = await this.db.policy
      .findUnique({
        where: { policyId: id },
        include: { sections: { orderBy: { sectionOrdinal: 'asc' } } },
      })
      .catch(() => {
        throw new ServiceUnavailableException('Policy database unavailable');
      });
    if (!policy) throw new NotFoundException('Policy not found');
    return policy;
  }
}
