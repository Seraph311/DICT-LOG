import { z } from 'zod';

function isRealDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(isRealDate, 'Invalid date');

export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM')
  .refine((value) => {
    const [year, month] = value.split('-').map(Number);
    return year >= 2000 && year <= 9999 && month >= 1 && month <= 12;
  }, 'Invalid month');

export const analyticsSchema = z
  .object({
    from: isoDate,
    to: isoDate,
  })
  .refine((data) => data.from <= data.to, {
    path: ['to'],
    message: 'End date must be on or after start date',
  });
