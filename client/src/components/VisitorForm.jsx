import { useEffect, useState } from 'react';
import { api } from '../api.js';
import {
  GENDERS,
  PURPOSES,
  emptyVisitor,
  todayISO,
  validateVisitor,
} from '../lib/validation.js';

function initialValues(initial) {
  if (!initial) return emptyVisitor();
  return {
    visit_date: initial.visit_date ?? todayISO(),
    name: initial.name ?? '',
    gender: initial.gender ?? '',
    purpose: initial.purpose ?? '',
    purpose_other: initial.purpose_other ?? '',
    contact_number: initial.contact_number ?? '',
  };
}

export default function VisitorForm({
  mode = 'create',
  initial = null,
  canEditDate,
  public: isPublic = false,
  onSaved,
  onCancel,
}) {
  const [values, setValues] = useState(() => initialValues(initial));
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [purposes, setPurposes] = useState(PURPOSES);

  useEffect(() => {
    api('/api/lookups')
      .then((data) => setPurposes(data.purposes))
      .catch(() => {});
  }, []);

  const purposeOptions = purposes.includes(values.purpose) || !values.purpose
    ? purposes
    : [values.purpose, ...purposes];

  const errors = validateVisitor(values, { requireDate: isPublic || canEditDate });

  function showError(field) {
    if (!attempted && !touched[field]) return '';
    return serverErrors[field] || errors[field] || '';
  }

  function update(field, value) {
    setValues((current) => ({
      ...current,
      [field]: value,
      ...(field === 'purpose' && value !== 'Others' ? { purpose_other: '' } : {}),
    }));
    setServerErrors((current) => ({ ...current, [field]: undefined }));
  }

  function markTouched(field) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setAttempted(true);
    setFormError('');

    if (Object.keys(errors).length > 0) return;

    const payload = {
      name: values.name.trim(),
      gender: values.gender,
      purpose: values.purpose,
      purpose_other: values.purpose === 'Others' ? values.purpose_other.trim() : null,
      contact_number: values.contact_number.trim(),
    };
    if (canEditDate) payload.visit_date = values.visit_date;
    if (isPublic) payload.website = '';

    setSubmitting(true);
    try {
      const data =
        mode === 'edit'
          ? await api(`/api/visitors/${initial.id}`, { method: 'PATCH', body: payload })
          : await api(isPublic ? '/api/visitors/public' : '/api/visitors', {
              method: 'POST',
              body: payload,
            });

      if (mode === 'create') {
        // Blur first so the reset form is not marked as "touched" by a later focus change.
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setValues(emptyVisitor());
        setTouched({});
        setAttempted(false);
      }
      onSaved(data.visitor);
    } catch (err) {
      setServerErrors(err.fields ?? {});
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="visitor-form" onSubmit={handleSubmit} noValidate>
      {formError && (
        <div className="alert alert-error" role="alert">
          {formError}
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="visit_date">Date</label>
          <input
            id="visit_date"
            type="date"
            value={values.visit_date}
            max={isPublic || canEditDate ? todayISO() : undefined}
            onChange={(event) => update('visit_date', event.target.value)}
            onBlur={() => markTouched('visit_date')}
            disabled={!canEditDate && !isPublic}
            readOnly={isPublic}
            aria-invalid={Boolean(showError('visit_date'))}
            aria-describedby={showError('visit_date') ? 'visit_date-error' : undefined}
          />
          {!canEditDate && !isPublic && (
            <p className="hint">Front desk entries are dated today. Administrators can backdate.</p>
          )}
          {isPublic && <p className="hint">Date is set automatically to today.</p>}
          {showError('visit_date') && (
            <p className="field-error" id="visit_date-error">
              {showError('visit_date')}
            </p>
          )}
        </div>

        {isPublic && <input type="text" name="website" tabIndex="-1" autoComplete="off" className="honeypot" />}

        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={values.name}
            maxLength={120}
            autoComplete="off"
            placeholder="Full name"
            onChange={(event) => update('name', event.target.value)}
            onBlur={() => markTouched('name')}
            aria-invalid={Boolean(showError('name'))}
            aria-describedby={showError('name') ? 'name-error' : undefined}
          />
          {showError('name') && (
            <p className="field-error" id="name-error">
              {showError('name')}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="gender">Gender</label>
          <select
            id="gender"
            value={values.gender}
            onChange={(event) => update('gender', event.target.value)}
            onBlur={() => markTouched('gender')}
            aria-invalid={Boolean(showError('gender'))}
            aria-describedby={showError('gender') ? 'gender-error' : undefined}
          >
            <option value="">Select gender</option>
            {GENDERS.map((gender) => (
              <option key={gender} value={gender}>
                {gender}
              </option>
            ))}
          </select>
          {showError('gender') && (
            <p className="field-error" id="gender-error">
              {showError('gender')}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="purpose">Purpose</label>
          <select
            id="purpose"
            value={values.purpose}
            onChange={(event) => update('purpose', event.target.value)}
            onBlur={() => markTouched('purpose')}
            aria-invalid={Boolean(showError('purpose'))}
            aria-describedby={showError('purpose') ? 'purpose-error' : undefined}
          >
            <option value="">Select purpose</option>
            {purposeOptions.map((purpose) => (
              <option key={purpose} value={purpose}>
                {purpose}
              </option>
            ))}
          </select>
          {showError('purpose') && (
            <p className="field-error" id="purpose-error">
              {showError('purpose')}
            </p>
          )}
        </div>

        {values.purpose === 'Others' && (
          <div className="field field-wide">
            <label htmlFor="purpose_other">Describe the purpose</label>
            <input
              id="purpose_other"
              type="text"
              value={values.purpose_other}
              maxLength={120}
              placeholder="Short description"
              onChange={(event) => update('purpose_other', event.target.value)}
              onBlur={() => markTouched('purpose_other')}
              aria-invalid={Boolean(showError('purpose_other'))}
              aria-describedby={showError('purpose_other') ? 'purpose_other-error' : undefined}
            />
            {showError('purpose_other') && (
              <p className="field-error" id="purpose_other-error">
                {showError('purpose_other')}
              </p>
            )}
          </div>
        )}

        <div className="field">
          <label htmlFor="contact_number">Contact number</label>
          <input
            id="contact_number"
            type="tel"
            inputMode="tel"
            value={values.contact_number}
            maxLength={13}
            placeholder="09XXXXXXXXX or +639XXXXXXXXX"
            onChange={(event) => update('contact_number', event.target.value)}
            onBlur={() => markTouched('contact_number')}
            aria-invalid={Boolean(showError('contact_number'))}
            aria-describedby={showError('contact_number') ? 'contact_number-error' : undefined}
          />
          {showError('contact_number') && (
            <p className="field-error" id="contact_number-error">
              {showError('contact_number')}
            </p>
          )}
        </div>
      </div>

      <div className="form-actions">
        <p className="hint">Press Enter to save.</p>
        <div className="form-buttons">
          {onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}
