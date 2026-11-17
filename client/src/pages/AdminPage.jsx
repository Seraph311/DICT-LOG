import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';

const LOOKUP_TYPES = ['purposes', 'offices', 'regions'];

function UserPanel() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', full_name: '', role: 'front_desk', password: '' });
  const [error, setError] = useState('');

  async function load() {
    setUsers((await api('/api/admin/users')).users);
  }
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  async function create(event) {
    event.preventDefault();
    try {
      await api('/api/admin/users', { method: 'POST', body: form });
      setForm({ username: '', full_name: '', role: 'front_desk', password: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateUser(user, changes) {
    try {
      await api(`/api/admin/users/${user.id}`, { method: 'PATCH', body: changes });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card">
      <h2>Users</h2>
      {error && <div className="alert alert-error">{error}</div>}
      <form className="admin-inline-form" onSubmit={create}>
        <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="front_desk">Front Desk</option>
          <option value="reviewer">Reviewer</option>
          <option value="administrator">Administrator</option>
        </select>
        <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="btn btn-primary" type="submit">Create user</button>
      </form>
      <div className="admin-list">
        {users.map((user) => (
          <div className="admin-row" key={user.id}>
            <strong>{user.full_name}</strong>
            <span className="muted">@{user.username}</span>
            <select value={user.role} onChange={(e) => updateUser(user, { role: e.target.value })}>
              <option value="front_desk">Front Desk</option>
              <option value="reviewer">Reviewer</option>
              <option value="administrator">Administrator</option>
            </select>
            <button className="btn btn-small btn-secondary" type="button" onClick={() => updateUser(user, { is_active: !user.is_active })}>
              {user.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function LookupPanel() {
  const [type, setType] = useState('purposes');
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [serviceType, setServiceType] = useState('External/Serbisyong Panlabas');
  const [error, setError] = useState('');

  async function load() {
    setItems((await api(`/api/admin/lookups/${type}`)).items);
  }
  useEffect(() => { load().catch((err) => setError(err.message)); }, [type]);

  async function add(event) {
    event.preventDefault();
    try {
      await api(`/api/admin/lookups/${type}`, {
        method: 'POST',
        body: { name, ...(type === 'offices' ? { service_type: serviceType } : {}) },
      });
      setName('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggle(item) {
    try {
      await api(`/api/admin/lookups/${type}/${item.id}`, {
        method: 'PATCH',
        body: { active: !item.active },
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card">
      <h2>Lookups</h2>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="admin-tabs">
        {LOOKUP_TYPES.map((value) => <button className={`dashboard-tab ${type === value ? 'is-active' : ''}`} type="button" key={value} onClick={() => setType(value)}>{value}</button>)}
      </div>
      <form className="admin-inline-form" onSubmit={add}>
        <input placeholder="New lookup name" value={name} onChange={(e) => setName(e.target.value)} />
        {type === 'offices' && (
          <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
            <option>External/Serbisyong Panlabas</option>
            <option>Internal/Serbisyong Panloob</option>
          </select>
        )}
        <button className="btn btn-primary" type="submit">Add</button>
      </form>
      <div className="admin-list">
        {items.map((item) => (
          <div className="admin-row" key={item.id}>
            <span>{item.name}</span>
            {item.service_type && <span className="muted">{item.service_type}</span>}
            <button className="btn btn-small btn-secondary" type="button" onClick={() => toggle(item)}>
              {item.active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function AuditPanel() {
  const [data, setData] = useState({ data: [], pagination: {} });
  const [action, setAction] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/api/admin/audit?page=1&pageSize=50${action ? `&action=${action}` : ''}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [action]);

  return (
    <section className="card">
      <h2>Audit log</h2>
      {error && <div className="alert alert-error">{error}</div>}
      <select value={action} onChange={(e) => setAction(e.target.value)}>
        <option value="">All actions</option>
        {['create', 'edit', 'void', 'import', 'export'].map((value) => <option key={value}>{value}</option>)}
      </select>
      <div className="table-scroll">
        <table className="visitor-table">
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {data.data.map((row) => (
              <tr key={row.id}><td>{new Date(row.created_at).toLocaleString()}</td><td>{row.full_name || 'Public'}</td><td>{row.action}</td><td>{row.entity}</td><td>{JSON.stringify(row.details)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ImportPanel() {
  const [type, setType] = useState('visitors');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!file) return;
    setError('');
    setResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`/api/import/${type}`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message || 'Import failed');
      }
      const rejectionBlob = await response.blob();
      const url = URL.createObjectURL(rejectionBlob);
      setResult({
        accepted: response.headers.get('X-Import-Accepted'),
        rejected: response.headers.get('X-Import-Rejected'),
        url,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card">
      <h2>Legacy import</h2>
      <p className="muted">CSV only, up to 5 MB. Existing rows are never overwritten.</p>
      {error && <div className="alert alert-error">{error}</div>}
      <form className="admin-inline-form" onSubmit={submit}>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="visitors">Visitors</option>
          <option value="csm">CSM responses</option>
        </select>
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files[0])} />
        <button className="btn btn-primary" type="submit" disabled={!file}>Import CSV</button>
      </form>
      {result && (
        <div className="alert alert-success">
          <span>Accepted: {result.accepted}; rejected: {result.rejected}.</span>
          <a href={result.url} download={`${type}-rejections.csv`}>Download rejection report</a>
        </div>
      )}
    </section>
  );
}

export default function AdminPage() {
  return (
    <Layout>
      <div className="page-heading"><div><p className="eyebrow">Administrator</p><h1>System administration</h1><p className="muted">Manage staff accounts, lookup lists, and audit history.</p></div></div>
      <UserPanel />
      <LookupPanel />
      <ImportPanel />
      <AuditPanel />
    </Layout>
  );
}
