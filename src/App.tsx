import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/pages/LoginPage';
import MyAgentsPage from '@/pages/MyAgentsPage';
import CatalogPage from '@/pages/CatalogPage';

const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><AppLayout>{children}</AppLayout></ProtectedRoute>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Protected><MyAgentsPage /></Protected>} />
          <Route path="/catalog" element={<Protected><CatalogPage /></Protected>} />
          <Route path="*" element={<Protected><MyAgentsPage /></Protected>} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  );
}
