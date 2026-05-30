import { z } from "zod/v3";

export const createVocabularySchema = z.object({
  term: z.string().min(1, "Term is required"),
  notes: z.string().optional(),
});

export const updateVocabularySchema = z.object({
  term: z.string().min(1, "Term is required").optional(),
  notes: z.string().optional(),
});

export type CreateVocabularyInput = z.infer<typeof createVocabularySchema>;
export type UpdateVocabularyInput = z.infer<typeof updateVocabularySchema>;
