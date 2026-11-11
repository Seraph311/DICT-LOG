import Layout from '../components/Layout.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

export default function ReviewerHome() {
  const { user } = useAuth();

  return (
    <Layout>
      <section className="card narrow-card">
        <h1>Reviewer workspace</h1>
        <p className="muted">
          Welcome, {user.full_name}. Dashboards, CSM aggregates, and exports are scheduled for a
          later sprint. Visitor log editing is limited to front desk and administrator accounts.
        </p>
      </section>
    </Layout>
  );
}
