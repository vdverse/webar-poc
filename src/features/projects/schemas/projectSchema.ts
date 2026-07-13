import { z } from 'zod';

import { ANGLE_LABELS, PROJECT_MODES, SOURCE_METHODS, WIZARD_STAGES } from '../types';

export const projectFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the project a name.')
    .max(120, 'Keep the name under 120 characters.'),
  description: z
    .string()
    .trim()
    .max(2000, 'Keep the description under 2000 characters.')
    .optional()
    .or(z.literal('')),
  mode: z.enum(PROJECT_MODES),
});
export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const sourceMethodSchema = z.enum(SOURCE_METHODS);

export const wizardStageSchema = z.enum(WIZARD_STAGES);

export const angleLabelSchema = z.enum(ANGLE_LABELS);

/** Shape persisted per uploaded source image (DB metadata, not the file). */
export const sourceImageMetadataSchema = z.object({
  storage_path: z.string().min(1),
  original_filename: z.string().min(1),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  file_size_bytes: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  angle_label: angleLabelSchema.nullable(),
  sort_order: z.number().int().min(0),
});
export type SourceImageMetadata = z.infer<typeof sourceImageMetadataSchema>;
