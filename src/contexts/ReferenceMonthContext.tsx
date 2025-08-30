import React, { createContext, useContext, useState, ReactNode } from 'react';
import { format, startOfMonth } from 'date-fns';

interface ReferenceMonthContextType {
  referenceMonth: string;
  setReferenceMonth: (month: string) => void;
}

const ReferenceMonthContext = createContext<ReferenceMonthContextType | undefined>(undefined);

export const useReferenceMonth = () => {
  const context = useContext(ReferenceMonthContext);
  if (context === undefined) {
    throw new Error('useReferenceMonth must be used within a ReferenceMonthProvider');
  }
  return context;
};

interface ReferenceMonthProviderProps {
  children: ReactNode;
}

export const ReferenceMonthProvider: React.FC<ReferenceMonthProviderProps> = ({ children }) => {
  const [referenceMonth, setReferenceMonth] = useState<string>(() => {
    const now = new Date();
    return format(startOfMonth(now), 'yyyy-MM-dd');
  });

  return (
    <ReferenceMonthContext.Provider value={{ referenceMonth, setReferenceMonth }}>
      {children}
    </ReferenceMonthContext.Provider>
  );
};