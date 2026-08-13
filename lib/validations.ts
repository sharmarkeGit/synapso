import { z } from 'zod'

export const createTopicSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
})

export type CreateTopicSchema = z.infer<typeof createTopicSchema>