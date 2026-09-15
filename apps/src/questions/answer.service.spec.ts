import { AnswerService } from './answer.service.js';
describe('Gemini answers', () => {
  const service = new AnswerService();
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('GEMINI_GENERATION_MODEL', 'test-model');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it('requires explicit generation configuration', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(() => service.assertConfigured()).toThrow('Set GEMINI_API_KEY');
  });
  it('uses system instructions and returns only answer text', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  parts: [
                    { text: 'hidden', thought: true },
                    { text: 'Answer [1]' },
                  ],
                },
              },
            ],
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    expect(await service.generate('Question', [])).toBe('Answer [1]');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).not.toContain('test-key');
    expect(JSON.parse(options.body).systemInstruction).toBeDefined();
  });
  it('sanitizes provider failures and rejects incomplete output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('secret', { status: 429 })),
    );
    await expect(service.generate('Question', [])).rejects.toThrow(
      'Answer provider unavailable',
    );
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'MAX_TOKENS',
                  content: { parts: [{ text: 'partial' }] },
                },
              ],
            }),
          ),
        ),
    );
    await expect(service.generate('Question', [])).rejects.toThrow(
      'Answer provider unavailable',
    );
  });
});
