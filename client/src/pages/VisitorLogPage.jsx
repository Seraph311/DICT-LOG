import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import VisitorForm from '../components/VisitorForm.jsx';
import VisitorTable from '../components/VisitorTable.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

export default function VisitorLogPage() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');

  const canEditDate = user.role === 'administrator';

  function handleChanged(message) {
    setNotice(message);
    setRefreshKey((current) => current + 1);
  }

  useEffect(() => {
    if (!editing) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') setEditing(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editing]);

  return (
    <Layout>
      <div className="page-heading">
        <div>
          <h1>Visitor Log</h1>
          <p className="muted">
            Record each visitor, then search or correct entries below.
            {!canEditDate && ' Entries are dated today for front desk accounts.'}
          </p>
        </div>
      </div>

      {notice && (
        <div className="alert alert-success" role="status">
          <span>{notice}</span>
          <button
            type="button"
            className="alert-close"
            onClick={() => setNotice('')}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <section className="card">
        <h2>New visitor entry</h2>
        <VisitorForm
          canEditDate={canEditDate}
          onSaved={() => handleChanged('Visitor log saved.')}
        />
      </section>

      <section className="card">
        <h2>Visitor records</h2>
        <VisitorTable
          refreshKey={refreshKey}
          onEdit={setEditing}
          notify={handleChanged}
        />
      </section>

      {editing && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
            <div className="modal-header">
              <h2 id="edit-title">Edit visitor log</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditing(null)}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>
            <VisitorForm
              mode="edit"
              initial={editing}
              canEditDate={canEditDate}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                handleChanged('Visitor log updated.');
              }}
            />
          </div>
        </div>
      )}
    </Layout>
  );
}
