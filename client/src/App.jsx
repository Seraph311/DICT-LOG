import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ReviewerHome from './pages/ReviewerHome.jsx';
import VisitorLogPage from './pages/VisitorLogPage.jsx';

function Home() {
  const { user } = useAuth();
  if (user.role === 'reviewer') {
    return <ReviewerHome />;
  }
  return <Navigate to="/visitors" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
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
