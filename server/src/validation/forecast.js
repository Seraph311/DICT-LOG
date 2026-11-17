import { z } from 'zod';

export const forecastQuerySchema = z.object({
  granularity: z.enum(['week', 'month']).default('week'),
});
