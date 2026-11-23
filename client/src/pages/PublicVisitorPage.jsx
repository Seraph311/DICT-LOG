import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import VisitorForm from '../components/VisitorForm.jsx';

export default function PublicVisitorPage() {
  const [notice, setNotice] = useState('');

  return (
    <Layout>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Welcome</p>
          <h1>Visitor log</h1>
          <p className="muted">Please share the details below to help us keep an accurate office log.</p>
        </div>
      </div>

      {notice && (
        <>
          <div className="alert alert-success" role="status">
            {notice}
          </div>
          <Link to="/survey" className="btn btn-primary">
            Answer our short client satisfaction survey
          </Link>
        </>
      )}

      <section className="card narrow-card">
        <VisitorForm
          public
          onSaved={() => setNotice('Thank you. Your visit has been recorded.')}
        />
      </section>
    </Layout>
  );
}
