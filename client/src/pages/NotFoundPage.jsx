import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';

export default function NotFoundPage() {
  return (
    <Layout>
      <section className="card narrow-card">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <Link className="btn btn-primary" to="/">
          Back to the home page
        </Link>
      </section>
    </Layout>
  );
}
