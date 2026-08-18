import { describe, expect, it } from 'vitest';

import { generateCurriculumSchema, submitReviewSchema } from './validations';

describe('generateCurriculumSchema', () => {
  it('accepts a valid topic title', () => {
    const result = generateCurriculumSchema.safeParse({ topicTitle: 'Photosynthesis' });
    expect(result.success).toBe(true);
  });

  it('rejects a topic title that is too short', () => {
    const result = generateCurriculumSchema.safeParse({ topicTitle: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing topicTitle field', () => {
    const result = generateCurriculumSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('submitReviewSchema', () => {
  it('accepts a valid cardId and quality', () => {
    const result = submitReviewSchema.safeParse({
      cardId: '8da115e6-0666-4b0e-956c-3369d0e5954f',
      quality: 3,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a quality above 5', () => {
    const result = submitReviewSchema.safeParse({
      cardId: '8da115e6-0666-4b0e-956c-3369d0e5954f',
      quality: 6,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a quality below 0', () => {
    const result = submitReviewSchema.safeParse({
      cardId: '8da115e6-0666-4b0e-956c-3369d0e5954f',
      quality: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID cardId', () => {
    const result = submitReviewSchema.safeParse({
      cardId: 'not-a-uuid',
      quality: 3,
    });
    expect(result.success).toBe(false);
  });
});
