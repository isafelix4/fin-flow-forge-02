import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ReferenceMonthProvider } from "@/contexts/ReferenceMonthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SecurityProvider } from "@/components/SecurityProvider";
import { useSecurityHeaders } from "@/hooks/useSecurityHeaders";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Contas from "./pages/Contas";
import Categorias from "./pages/Categorias";
import Investimentos from "./pages/Investimentos";
import Dividas from "./pages/Dividas";
import Transacoes from "./pages/Transacoes";
import ImportarTransacoes from "./pages/ImportarTransacoes";
import Planejamento from "./pages/Planejamento";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useSecurityHeaders();
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SecurityProvider>
              <ReferenceMonthProvider>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/contas" 
              element={
                <ProtectedRoute>
                  <Contas />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/categorias" 
              element={
                <ProtectedRoute>
                  <Categorias />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/investimentos" 
              element={
                <ProtectedRoute>
                  <Investimentos />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dividas" 
              element={
                <ProtectedRoute>
                  <Dividas />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/transacoes" 
              element={
                <ProtectedRoute>
                  <Transacoes />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/importar" 
              element={
                <ProtectedRoute>
                  <ImportarTransacoes />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/planejamento" 
              element={
                <ProtectedRoute>
                  <Planejamento />
                </ProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
              </ReferenceMonthProvider>
            </SecurityProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
