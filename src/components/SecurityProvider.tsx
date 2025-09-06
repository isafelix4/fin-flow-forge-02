import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSecurityValidation } from '@/hooks/useSecurityValidation';

interface SecurityContextType {
  logSecurityEvent: (eventType: string, eventDetails?: Record<string, any>) => Promise<void>;
  validateInput: (input: string, maxLength?: number) => string;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { logSecurityEvent, sanitizeInput } = useSecurityValidation();

  useEffect(() => {
    // Set up security headers and monitoring
    const setupSecurityMonitoring = async () => {
      // Log user session start
      if (user) {
        await logSecurityEvent('session_started', {
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        });
      }

      // Monitor for suspicious activity
      const handleVisibilityChange = () => {
        if (document.hidden && user) {
          logSecurityEvent('session_hidden', { timestamp: new Date().toISOString() });
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    };

    setupSecurityMonitoring();
  }, [user, logSecurityEvent]);

  const handleLogSecurityEvent = async (eventType: string, eventDetails: Record<string, any> = {}) => {
    await logSecurityEvent(eventType, {
      ...eventDetails,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent
    });
  };

  const validateInput = (input: string, maxLength: number = 1000) => {
    return sanitizeInput(input, maxLength);
  };

  const value = {
    logSecurityEvent: handleLogSecurityEvent,
    validateInput
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};