export const AGE_GROUPS = ['18-25', '26-35', '36-45', '46-60', '60 and above (60 pataas)', 'Other'];
export const SEXES = ['Male', 'Female', 'Prefer not to say'];
export const GENDERS = ['Masculine', 'Feminine', 'Non-Binary', 'Prefer Not to Say', 'Other'];
export const REGIONS = [
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

export const OFFICES = {
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

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function emptyCsm() {
  return {
    response_date: todayISO(),
    email: '',
    age_group: '',
    sex: '',
    gender: '',
    region: '',
    service_type: '',
    office: '',
    age_other: '',
    gender_other: '',
    comment: '',
  };
}

export function validateCsm(values) {
  const errors = {};
  if (!values.response_date) errors.response_date = 'Date is required';
  if (!values.email?.trim()) errors.email = 'Email is required';
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())) errors.email = 'Enter a valid email';
  if (!AGE_GROUPS.includes(values.age_group)) errors.age_group = 'Select an age group';
  if (values.age_group === 'Other' && !values.age_other?.trim()) errors.age_other = 'Describe your age';
  else if (values.age_group === 'Other' && values.age_other.trim().length > 30) errors.age_other = 'Maximum 30 characters';
  if (!SEXES.includes(values.sex)) errors.sex = 'Select a sex';
  if (!GENDERS.includes(values.gender)) errors.gender = 'Select a gender';
  if (values.gender === 'Other' && !values.gender_other?.trim()) errors.gender_other = 'Describe your gender';
  else if (values.gender === 'Other' && values.gender_other.trim().length > 50) errors.gender_other = 'Maximum 50 characters';
  if (!REGIONS.includes(values.region)) errors.region = 'Select a region';
  if (!OFFICES[values.service_type]) errors.service_type = 'Select a service type';
  if (!OFFICES[values.service_type]?.includes(values.office)) errors.office = 'Select a matching office';
  return errors;
}
