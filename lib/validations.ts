import { z } from 'zod'

export const createTopicSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
})

export type CreateTopicSchema = z.infer<typeof createTopicSchema>

export const curriculumSchema = z.object({
  modules: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
      cards: z.array(
        z.object({
          question: z.string(),
          answer: z.string(),
        })
      ),
    })
  ),
})

export const generateCurriculumSchema = z.object({
  topicTitle: z.string().min(3).max(100),
})