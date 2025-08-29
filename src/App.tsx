import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Contas from "./pages/Contas";
import Categorias from "./pages/Categorias";
import Investimentos from "./pages/Investimentos";
import Dividas from "./pages/Dividas";
import Transacoes from "./pages/Transacoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
