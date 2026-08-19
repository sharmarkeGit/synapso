import { z } from 'zod';

export const createTopicSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
});

export type CreateTopicSchema = z.infer<typeof createTopicSchema>;

export const curriculumSchema = z.object({
  isValidTopic: z.boolean(),
  // null when isValidTopic is true. OpenAI's Structured Outputs mode
  // requires every property to be listed in `required`, so this uses
  // .nullable() rather than .optional() — optional (an absent key) isn't
  // supported, but a present key with a null value is.
  rejectionReason: z.string().nullable(),
  // Always present; an empty array when isValidTopic is false.
  modules: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
      cards: z.array(
        z.object({
          question: z.string(),
          answer: z.string(),
        }),
      ),
    }),
  ),
});

export type CurriculumSchema = z.infer<typeof curriculumSchema>;

export const generateCurriculumSchema = z.object({
  topicTitle: z.string().min(3).max(100),
});

export const feynmanCheckSchema = z.object({
  moduleId: z.uuid(),
  userExplanation: z.string().min(20, 'Please write at least a few sentences.'),
});

export const feynmanEvaluationSchema = z.object({
  understoodWell: z.array(z.string()),
  gaps: z.array(z.string()),
  clarification: z.string(),
  masteryScore: z.number().min(0).max(100),
});

export const submitReviewSchema = z.object({
  cardId: z.uuid(),
  quality: z.number().int().min(0).max(5),
});
