import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/pages/LoginPage';
import MyAgentsPage from '@/pages/MyAgentsPage';
import CatalogPage from '@/pages/CatalogPage';
import AgentChatPage from '@/pages/AgentChatPage';
import AgentRunsPage from '@/pages/AgentRunsPage';
import AgentMemoryPage from '@/pages/AgentMemoryPage';
import IntegrationsPage from '@/pages/IntegrationsPage';
import AgentTeamsPage from '@/pages/AgentTeamsPage';
import TeamChatPage from '@/pages/TeamChatPage';
import MarketplacePage from '@/pages/MarketplacePage';

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
          {/* Per-agent pages — chat and run history */}
          <Route path="/agents/:id/chat"   element={<Protected><AgentChatPage /></Protected>} />
          <Route path="/agents/:id/runs"   element={<Protected><AgentRunsPage /></Protected>} />
          <Route path="/agents/:id/memory" element={<Protected><AgentMemoryPage /></Protected>} />
          <Route path="/integrations"      element={<Protected><IntegrationsPage /></Protected>} />
          <Route path="/teams"             element={<Protected><AgentTeamsPage /></Protected>} />
          <Route path="/teams/:id/chat"    element={<Protected><TeamChatPage /></Protected>} />
          <Route path="/marketplace"       element={<Protected><MarketplacePage /></Protected>} />
          <Route path="*" element={<Protected><MyAgentsPage /></Protected>} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  );
}
