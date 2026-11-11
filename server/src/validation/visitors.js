import { z } from 'zod';

const PHONE_PATTERN = /^(09\d{9}|\+639\d{9})$/;

export function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isRealDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(isRealDate, 'Invalid date')
  .refine((value) => value <= todayISO(), 'Visit date cannot be in the future');

const visitorFields = {
  visit_date: isoDate.optional(),
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  gender: z.enum(['Male', 'Female', 'Others'], { error: 'Select a valid gender' }),
  purpose: z.string().trim().min(1, 'Purpose is required').max(120),
  purpose_other: z.string().trim().max(120, 'Description is too long').nullable().optional(),
  contact_number: z
    .string()
    .trim()
    .regex(PHONE_PATTERN, 'Use 09XXXXXXXXX or +639XXXXXXXXX'),
};

export const createVisitorSchema = z
  .object(visitorFields)
  .superRefine((data, ctx) => {
    if (data.purpose === 'Others' && !data.purpose_other) {
      ctx.addIssue({
        code: 'custom',
        path: ['purpose_other'],
        message: 'Describe the purpose when Others is selected',
      });
    }
  });

export const updateVisitorSchema = z
  .object(visitorFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export const listVisitorsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  purpose: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  includeVoided: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const voidVisitorSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export const idSchema = z.coerce.number().int().positive();
