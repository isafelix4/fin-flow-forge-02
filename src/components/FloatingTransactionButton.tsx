import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TransactionModal } from './TransactionModal';

interface FloatingTransactionButtonProps {
  className?: string;
  onTransactionSaved?: () => void;
}

export const FloatingTransactionButton: React.FC<FloatingTransactionButtonProps> = ({ 
  className = "",
  onTransactionSaved
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleTransactionSaved = () => {
    if (onTransactionSaved) {
      onTransactionSaved();
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        className={`bg-primary text-primary-foreground hover:bg-primary/90 ${className}`}
      >
        <Plus className="h-4 w-4 mr-2" />
        Nova Transação
      </Button>
      
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTransactionSaved={handleTransactionSaved}
      />
    </>
  );
};