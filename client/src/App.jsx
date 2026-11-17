import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PublicVisitorPage from './pages/PublicVisitorPage.jsx';
import SurveyPage from './pages/SurveyPage.jsx';
import VisitorLogPage from './pages/VisitorLogPage.jsx';

function StaffHome() {
  const { user } = useAuth();
  if (user.role === 'reviewer' || user.role === 'administrator') {
    return <DashboardPage />;
  }
  return <Navigate to="/visitors" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/survey" element={<SurveyPage />} />
      <Route
        path="/"
        element={<PublicVisitorPage />}
      />
      <Route
        path="/staff"
        element={
          <ProtectedRoute>
            <StaffHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={['reviewer', 'administrator']}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/visitors"
        element={
          <ProtectedRoute roles={['front_desk', 'administrator']}>
            <VisitorLogPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
