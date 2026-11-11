import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { PURPOSES, formatVisitDate } from '../lib/validation.js';

const PAGE_SIZE = 25;

export default function VisitorTable({ refreshKey, onEdit, notify }) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [purpose, setPurpose] = useState('');
  const [showVoided, setShowVoided] = useState(false);
  const [page, setPage] = useState(1);

  const [result, setResult] = useState({ data: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voidingId, setVoidingId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debouncedQ) params.set('q', debouncedQ);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (purpose) params.set('purpose', purpose);
    if (showVoided) params.set('includeVoided', 'true');

    setLoading(true);
    api(`/api/visitors?${params.toString()}`)
      .then((data) => {
        if (ignore) return;
        setResult(data);
        setError('');
      })
      .catch((err) => {
        if (ignore) return;
        setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [debouncedQ, from, to, purpose, page, showVoided, refreshKey]);

  function resetFilters() {
    setQ('');
    setFrom('');
    setTo('');
    setPurpose('');
    setShowVoided(false);
    setPage(1);
  }

  async function handleVoid(visitor) {
    const confirmed = window.confirm(
      `Void the entry for ${visitor.name} on ${formatVisitDate(visitor.visit_date)}?\n\nVoided entries are kept for the record and cannot be edited.`,
    );
    if (!confirmed) return;

    setVoidingId(visitor.id);
    setError('');
    try {
      await api(`/api/visitors/${visitor.id}/void`, { method: 'POST' });
      notify('Visitor log voided.');
    } catch (err) {
      setError(err.message);
    } finally {
      setVoidingId(null);
    }
  }

  const rows = result.data ?? [];
  const pagination = result.pagination;

  return (
    <div className="table-wrap">
      <div className="filters">
        <div className="field">
          <label htmlFor="search">Search by name</label>
          <input
            id="search"
            type="search"
            value={q}
            placeholder="Type a name…"
            onChange={(event) => setQ(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="filter-from">From</label>
          <input
            id="filter-from"
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="field">
          <label htmlFor="filter-to">To</label>
          <input
            id="filter-to"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="field">
          <label htmlFor="filter-purpose">Purpose</label>
          <select
            id="filter-purpose"
            value={purpose}
            onChange={(event) => {
              setPurpose(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All purposes</option>
            {PURPOSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-actions">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={showVoided}
              onChange={(event) => {
                setShowVoided(event.target.checked);
                setPage(1);
              }}
            />
            Show voided
          </label>
          <button type="button" className="btn btn-secondary btn-small" onClick={resetFilters}>
            Reset filters
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <div className={loading ? 'table-scroll is-loading' : 'table-scroll'}>
        <table className="visitor-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Name</th>
              <th scope="col">Gender</th>
              <th scope="col">Purpose</th>
              <th scope="col">Contact number</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="empty-cell">
                  No visitor logs match these filters.
                </td>
              </tr>
            ) : (
              rows.map((visitor) => (
                <tr key={visitor.id} className={visitor.voided ? 'row-voided' : ''}>
                  <td className="nowrap">{formatVisitDate(visitor.visit_date)}</td>
                  <td>{visitor.name}</td>
                  <td>{visitor.gender}</td>
                  <td>
                    {visitor.purpose}
                    {visitor.purpose_other && (
                      <span className="purpose-note"> — {visitor.purpose_other}</span>
                    )}
                  </td>
                  <td className="nowrap">{visitor.contact_number}</td>
                  <td>
                    <span className={visitor.voided ? 'badge badge-void' : 'badge badge-active'}>
                      {visitor.voided ? 'Voided' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => onEdit(visitor)}
                        disabled={visitor.voided}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="link-button link-danger"
                        onClick={() => handleVoid(visitor)}
                        disabled={visitor.voided || voidingId === visitor.id}
                      >
                        {voidingId === visitor.id ? 'Voiding…' : 'Void'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <span>
          {pagination
            ? `${pagination.total} record${pagination.total === 1 ? '' : 's'}`
            : 'No records'}
          {loading ? ' · loading…' : ''}
        </span>
        <div className="pager">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            disabled={!pagination || page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </button>
          <span>
            Page {pagination?.page ?? 1} of {Math.max(pagination?.totalPages ?? 1, 1)}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            disabled={!pagination || page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
