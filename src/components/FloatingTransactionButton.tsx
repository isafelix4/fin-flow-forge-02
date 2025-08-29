import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TransactionModal } from './TransactionModal';

interface FloatingTransactionButtonProps {
  className?: string;
}

export const FloatingTransactionButton: React.FC<FloatingTransactionButtonProps> = ({ className = "" }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        className={`fixed bottom-6 right-6 h-14 w-auto px-4 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 z-50 ${className}`}
        size="lg"
      >
        <Plus className="h-5 w-5 mr-2" />
        Nova Transação
      </Button>
      
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};