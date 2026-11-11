import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';

export default function ForbiddenPage() {
  return (
    <Layout>
      <section className="card narrow-card">
        <p className="eyebrow">403</p>
        <h1>You don’t have access to this page</h1>
        <p className="muted">Your account role does not include visitor log access.</p>
        <Link className="btn btn-primary" to="/">
          Back to your workspace
        </Link>
      </section>
    </Layout>
  );
}
