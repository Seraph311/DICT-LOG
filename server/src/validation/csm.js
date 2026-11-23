import { z } from 'zod';

export const CSM_SERVICE_TYPES = [
  'External/Serbisyong Panlabas',
  'Internal/Serbisyong Panloob',
];

export const CSM_OFFICES = {
  'External/Serbisyong Panlabas': [
    'Cybersecurity Bureau',
    'Government Digital Transformation Bureau',
    'ICT Literacy and Competency Development Bureau',
    'Infostructure Management Bureau',
    'Legal Service (External)',
    'Postal Regulation Division',
    'Regional Office (External)',
    'Consumer Complaint Center',
  ],
  'Internal/Serbisyong Panloob': [
    'Administrative Service',
    'Central Receiving and Releasing Unit',
    'Finance Service',
    'Legal Service (Internal)',
    'Management Information Systems Service',
    'Procurement Service',
    'Regional Offices (Internal)',
  ],
};

const AGE_GROUPS = ['18-25', '26-35', '36-45', '46-60', '60 and above (60 pataas)', 'Other'];
const SEXES = ['Male', 'Female', 'Prefer not to say'];
const GENDERS = ['Masculine', 'Feminine', 'Non-Binary', 'Prefer Not to Say', 'Other'];
const REGIONS = [
  'National Capital Region (NCR)',
  'Cordillera Administrative Region (CAR)',
  'Ilocos Region (Region I)',
  'Cagayan Valley (Region II)',
  'Central Luzon (Region III)',
  'CALABARZON (Region IV-A)',
  'MIMAROPA (Region IV-B)',
  'Bicol Region (Region V)',
  'Western Visayas (Region VI)',
  'Central Visayas (Region VII)',
  'Eastern Visayas (Region VIII)',
  'Zamboanga Peninsula (Region IX)',
  'Northern Mindanao (Region X)',
  'Davao Region (Region XI)',
  'SOCCSKSARGEN (Region XII)',
  'Caraga (Region XIII)',
  'BARMM',
];

function isRealDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const csmSchema = z
  .object({
    response_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .refine(isRealDate, 'Invalid date')
      .refine((value) => value <= new Date().toISOString().slice(0, 10), 'Date cannot be in the future'),
    age_group: z.enum(AGE_GROUPS, { error: 'Select a valid age group' }),
    age_other: z.string().trim().max(30).optional().nullable(),
    sex: z.enum(SEXES, { error: 'Select a valid sex' }),
    gender: z.enum(GENDERS, { error: 'Select a valid gender' }),
    gender_other: z.string().trim().max(50).optional().nullable(),
    region: z.enum(REGIONS, { error: 'Select a valid region' }),
    service_type: z.enum(CSM_SERVICE_TYPES, { error: 'Select a valid service type' }),
    office: z.string().trim().min(1, 'Select an office'),
    comment: z.string().trim().max(1000).optional().nullable(),
    website: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.website) {
      ctx.addIssue({ code: 'custom', path: ['website'], message: 'Bot submission rejected' });
    }
    if (data.age_group === 'Other' && !data.age_other) {
      ctx.addIssue({ code: 'custom', path: ['age_other'], message: 'Describe your age' });
    }
    if (data.age_group !== 'Other' && data.age_other?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['age_other'], message: 'Age detail is only allowed for Other' });
    }
    if (data.gender === 'Other' && !data.gender_other) {
      ctx.addIssue({ code: 'custom', path: ['gender_other'], message: 'Describe your gender' });
    }
    if (data.gender !== 'Other' && data.gender_other?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['gender_other'], message: 'Gender detail is only allowed for Other' });
    }
    if (!CSM_OFFICES[data.service_type].includes(data.office)) {
      ctx.addIssue({
        code: 'custom',
        path: ['office'],
        message: 'Select an office that matches the service type',
      });
    }
  });

export { AGE_GROUPS, GENDERS, REGIONS, SEXES };
