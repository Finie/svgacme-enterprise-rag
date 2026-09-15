import { BadRequestException } from '@nestjs/common';
export function textBody(
  body: unknown,
  key: string,
): { text: string; topK: number } {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BadRequestException('A JSON object is required');
  const data = body as Record<string, unknown>;
  const text = data[key];
  if (typeof text !== 'string' || !text.trim() || text.length > 4000)
    throw new BadRequestException(
      `${key} must be a nonempty string of at most 4000 characters`,
    );
  const topK = data.topK ?? 5;
  if (
    typeof topK !== 'number' ||
    !Number.isSafeInteger(topK) ||
    topK < 1 ||
    topK > 20
  )
    throw new BadRequestException('topK must be an integer from 1 to 20');
  return { text: text.trim(), topK };
}
