import React from 'react';
import { Header } from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { FloatingTransactionButton } from '@/components/FloatingTransactionButton';

const Index = () => {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold">
            Bem-vindo à Plataforma de Gestão Financeira
          </h1>
          <FloatingTransactionButton />
        </div>
        <div className="text-center">
          <p className="text-xl text-muted-foreground mb-6">
            Olá, {user?.user_metadata?.nome || user?.email}!
          </p>
          <p className="text-lg text-muted-foreground">
            Aqui você pode gerenciar suas finanças pessoais de forma simples e eficiente.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;
