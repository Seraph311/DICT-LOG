import { useEffect, useState } from 'react';
import { api } from '../api.js';
import TopBar from '../components/TopBar.jsx';
import {
  AGE_GROUPS,
  emptyCsm,
  GENDERS,
  OFFICES,
  REGIONS,
  SEXES,
  validateCsm,
} from '../lib/csm.js';

const CONFIDENTIALITY =
  'This Client Satisfaction Measurement (CSM) survey aims to track the client experience of government offices. Your answers will enable this office to provide a better service. For privacy and security, rest assured that all the information that you will share shall remain confidential.';
const FILIPINO_CONFIDENTIALITY =
  '(Ang Client Satisfaction Measurement (CSM) ay naglalayong masubaybayan ang karanasan ng taumbayan hinggil sa kanilang pakikitransaksyon sa mga tanggapan ng gobyerno. Makatutulong ang inyong kasagutan ukol sa inyong naging karanasan sa katatapos lamang na transaksyon, na mas mapabuti at lalong mapaglingkuran ang aming serbisyo publiko. Ang personal na impormasyon na iyong ibabahagi ay mananatiling kumpidensyal.)';
const CONTACT_POINTS =
  'Anti-Red Tape Authority (ARTA) - 8478-5099 / complaints@arta.gov.ph; Presidential Action Center (PACe) - 8888; CSE Contact Center ng Bayan - 1-6565 / email@contactcenterngbayan.gov.ph';

export default function SurveyPage() {
  const [values, setValues] = useState(emptyCsm);
  const [lookups, setLookups] = useState({ age_groups: AGE_GROUPS, regions: REGIONS, offices: OFFICES });
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/api/lookups')
      .then((data) => setLookups(data))
      .catch(() => {});
  }, []);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value, ...(field === 'service_type' ? { office: '' } : {}) }));
    setErrors((current) => ({ ...current, [field]: undefined, ...(field === 'service_type' ? { office: undefined } : {}) }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateCsm(values);
    setErrors(nextErrors);
    setRequestError('');
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await api('/api/csm', { method: 'POST', body: values });
      setSubmitted(true);
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="app">
        <TopBar />
        <main className="survey-shell">
        <section className="survey-card survey-success" role="status">
          <span className="survey-mark" aria-hidden="true">DICT</span>
          <p className="eyebrow">Response received</p>
          <h1>Thank you for sharing your experience.</h1>
          <p className="muted">Your confidential response helps the office improve its service.</p>
        </section>
        </main>
      </div>
    );
  }

  const officeOptions = lookups.offices[values.service_type] ?? [];

  return (
    <div className="app">
      <TopBar />
      <main className="survey-shell">
      <section className="survey-card">
        <span className="survey-mark" aria-hidden="true">DICT</span>
        <p className="eyebrow">Online Client Satisfaction Measurement</p>
        <h1>Tell us about your service experience</h1>
        <div className="survey-intro">
          <p>{CONFIDENTIALITY}</p>
          <p>{FILIPINO_CONFIDENTIALITY}</p>
          <p className="survey-contact">{CONTACT_POINTS}</p>
          <p className="required-note">* Indicates required question</p>
        </div>

        {requestError && <div className="alert alert-error" role="alert">{requestError}</div>}

        <form className="survey-form" onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            {[
              ['email', 'Email *', 'email', 'you@example.com'],
              ['response_date', 'Date (Petsa) *', 'date', undefined],
            ].map(([field, label, type, placeholder]) => (
              <div className="field" key={field}>
                <label htmlFor={`survey-${field}`}>{label}</label>
                <input
                  id={`survey-${field}`}
                  type={type}
                  value={values[field]}
                  placeholder={placeholder}
                  onChange={(event) => update(field, event.target.value)}
                  aria-invalid={Boolean(errors[field])}
                />
                {errors[field] && <span className="field-error">{errors[field]}</span>}
              </div>
            ))}
            {[
              ['age_group', 'Age (Edad) *', lookups.age_groups],
              ['sex', 'Sex (Kasariang bayolohikal) *', SEXES],
              ['gender', 'Gender (Kasarian) *', GENDERS],
              ['region', 'Region of residence (Rehiyon ng Tirahan) *', lookups.regions],
              ['service_type', 'Type of Service (Uri ng Serbisyo) *', Object.keys(lookups.offices)],
              ['office', values.service_type === 'External/Serbisyong Panlabas'
                ? 'Office visited/concerned (Opisinang katransaksyon) *'
                : 'Office visited/concerned *', officeOptions],
            ].map(([field, label, options]) => (
              <div className="field" key={field}>
                <label htmlFor={`survey-${field}`}>{label}</label>
                <select
                  id={`survey-${field}`}
                  value={values[field]}
                  disabled={field === 'office' && !values.service_type}
                  onChange={(event) => update(field, event.target.value)}
                  aria-invalid={Boolean(errors[field])}
                >
                  <option value="">Select {label.toLowerCase()}</option>
                  {options.map((option) => <option value={option} key={option}>{option}</option>)}
                </select>
                {errors[field] && <span className="field-error">{errors[field]}</span>}
              </div>
            ))}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
            {saving ? 'Submitting…' : 'Submit response'}
          </button>
        </form>
      </section>
      </main>
    </div>
  );
}
