import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app/app.module.js';
import { PrismaService } from '@/database/prisma.service.js';
import { SearchService } from '@/search/search.service.js';
import { AnswerService } from '@/questions/answer.service.js';

describe('HTTP API', () => {
  let app: INestApplication;
  const db = { $queryRaw: vi.fn(), policy: { findUnique: vi.fn() } };
  const search = { find: vi.fn() };
  const answers = { assertConfigured: vi.fn(), generate: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    db.$queryRaw.mockResolvedValue([{ value: 1 }]);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(SearchService)
      .useValue(search)
      .overrideProvider(AnswerService)
      .useValue(answers)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  it('preserves the root endpoint', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
  it('reports database health and outages', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' });
    db.$queryRaw.mockRejectedValue(new Error('private connection details'));
    const r = await request(app.getHttpServer()).get('/health').expect(503);
    expect(JSON.stringify(r.body)).not.toContain('private');
  });
  it('returns policy sections and handles missing policies', async () => {
    db.policy.findUnique
      .mockResolvedValueOnce({ policyId: 'HR-POL-001', sections: [] })
      .mockResolvedValueOnce(null);
    await request(app.getHttpServer()).get('/policies/HR-POL-001').expect(200);
    expect(db.policy.findUnique).toHaveBeenCalledWith({
      where: { policyId: 'HR-POL-001' },
      include: { sections: { orderBy: { sectionOrdinal: 'asc' } } },
    });
    await request(app.getHttpServer()).get('/policies/missing').expect(404);
  });
  it('validates requests before searching', async () => {
    for (const body of [
      {},
      { query: ' ' },
      { query: 42 },
      { query: 'ok', topK: 0 },
      { query: 'ok', topK: '5' },
      { query: 'x'.repeat(4001) },
    ]) {
      await request(app.getHttpServer()).post('/search').send(body).expect(400);
    }
    await request(app.getHttpServer())
      .post('/questions')
      .send({ question: '' })
      .expect(400);
    expect(search.find).not.toHaveBeenCalled();
  });
  it('returns search evidence', async () => {
    search.find.mockResolvedValue([{ chunkId: 'c1', content: 'Evidence' }]);
    const r = await request(app.getHttpServer())
      .post('/search')
      .send({ query: ' leave ', topK: 3 })
      .expect(200);
    expect(search.find).toHaveBeenCalledWith('leave', 3);
    expect(r.body.results[0].chunkId).toBe('c1');
  });
  it('answers using retrieved sources', async () => {
    search.find.mockResolvedValue([{ chunkId: 'c1', content: 'Evidence' }]);
    answers.generate.mockResolvedValue('Answer [1]');
    const r = await request(app.getHttpServer())
      .post('/questions')
      .send({ question: 'Leave rules?' })
      .expect(200);
    expect(r.body.answer).toBe('Answer [1]');
    expect(r.body.sources[0].reference).toBe(1);
    expect(answers.generate).toHaveBeenCalledWith(
      'Leave rules?',
      r.body.sources,
    );
  });
  it('does not generate without evidence', async () => {
    search.find.mockResolvedValue([]);
    const r = await request(app.getHttpServer())
      .post('/questions')
      .send({ question: 'Unknown?' })
      .expect(200);
    expect(r.body.sources).toEqual([]);
    expect(answers.generate).not.toHaveBeenCalled();
  });
});
