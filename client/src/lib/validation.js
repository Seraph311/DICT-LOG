export const PURPOSES = [
  'PSA Appointment',
  'eGovPH app Assistance',
  'NBI Appointment',
  'SSS assistance',
  'Others',
];

export const GENDERS = ['Male', 'Female', 'Others'];

export const PHONE_PATTERN = /^(09\d{9}|\+639\d{9})$/;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isRealDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateVisitor(values, { requireDate = true } = {}) {
  const errors = {};

  if (requireDate) {
    if (!values.visit_date) {
      errors.visit_date = 'Date is required';
    } else if (!isRealDate(values.visit_date)) {
      errors.visit_date = 'Enter a valid date';
    } else if (values.visit_date > todayISO()) {
      errors.visit_date = 'Visit date cannot be in the future';
    }
  }

  if (!values.name?.trim()) {
    errors.name = 'Name is required';
  } else if (values.name.trim().length > 120) {
    errors.name = 'Name is too long';
  }

  if (!GENDERS.includes(values.gender)) {
    errors.gender = 'Select a gender';
  }

  if (!PURPOSES.includes(values.purpose)) {
    errors.purpose = 'Select a purpose';
  }

  if (values.purpose === 'Others' && !values.purpose_other?.trim()) {
    errors.purpose_other = 'Describe the purpose when Others is selected';
  }

  if (!values.contact_number?.trim()) {
    errors.contact_number = 'Contact number is required';
  } else if (!PHONE_PATTERN.test(values.contact_number.trim())) {
    errors.contact_number = 'Use 09XXXXXXXXX or +639XXXXXXXXX';
  }

  return errors;
}

export function emptyVisitor() {
  return {
    visit_date: todayISO(),
    name: '',
    gender: '',
    purpose: '',
    purpose_other: '',
    contact_number: '',
  };
}

export function formatVisitDate(value) {
  if (!value) return '—';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
