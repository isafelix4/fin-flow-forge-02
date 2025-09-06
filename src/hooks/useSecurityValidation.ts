import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

interface RateLimitState {
  attempts: number;
  lastAttempt: number;
  blocked: boolean;
}

export const useSecurityValidation = () => {
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    attempts: 0,
    lastAttempt: 0,
    blocked: false
  });

  // Enhanced password validation
  const validatePassword = (password: string): PasswordValidationResult => {
    const errors: string[] = [];
    let strength: 'weak' | 'medium' | 'strong' = 'weak';

    // Minimum length check
    if (password.length < 8) {
      errors.push('A senha deve ter pelo menos 8 caracteres');
    }

    // Complexity checks
    if (!/[a-z]/.test(password)) {
      errors.push('A senha deve conter pelo menos uma letra minúscula');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('A senha deve conter pelo menos uma letra maiúscula');
    }

    if (!/\d/.test(password)) {
      errors.push('A senha deve conter pelo menos um número');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('A senha deve conter pelo menos um caractere especial');
    }

    // Check for common patterns
    if (/(.)\1{2,}/.test(password)) {
      errors.push('A senha não deve conter caracteres repetidos consecutivos');
    }

    if (/123|abc|password|senha|admin/i.test(password)) {
      errors.push('A senha não deve conter sequências óbvias ou palavras comuns');
    }

    // Determine strength
    if (errors.length === 0) {
      if (password.length >= 12 && /[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        strength = 'strong';
      } else if (password.length >= 8) {
        strength = 'medium';
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength
    };
  };

  // Rate limiting for authentication attempts
  const checkRateLimit = (maxAttempts = 5, timeWindow = 300000): boolean => { // 5 minutes
    const now = Date.now();
    
    // Reset if time window has passed
    if (now - rateLimitState.lastAttempt > timeWindow) {
      setRateLimitState({
        attempts: 0,
        lastAttempt: now,
        blocked: false
      });
      return true;
    }

    // Check if blocked
    if (rateLimitState.attempts >= maxAttempts) {
      const timeLeft = Math.ceil((timeWindow - (now - rateLimitState.lastAttempt)) / 60000);
      toast({
        title: "Muitas tentativas",
        description: `Aguarde ${timeLeft} minutos antes de tentar novamente`,
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  // Record failed authentication attempt
  const recordFailedAttempt = () => {
    setRateLimitState(prev => ({
      attempts: prev.attempts + 1,
      lastAttempt: Date.now(),
      blocked: prev.attempts + 1 >= 5
    }));
  };

  // Reset rate limit on successful authentication
  const resetRateLimit = () => {
    setRateLimitState({
      attempts: 0,
      lastAttempt: 0,
      blocked: false
    });
  };

  // Security event logging
  const logSecurityEvent = async (eventType: string, eventDetails: Record<string, any> = {}) => {
    try {
      const { error } = await supabase.rpc('log_security_event', {
        event_type_input: eventType,
        event_details_input: eventDetails
      });

      if (error) {
        console.error('Failed to log security event:', error);
      }
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  };

  // Input sanitization for user inputs
  const sanitizeInput = (input: string, maxLength = 1000): string => {
    if (!input) return '';

    let sanitized = input.trim();
    
    // Remove script tags and potential XSS
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/data:/gi, '');
    sanitized = sanitized.replace(/vbscript:/gi, '');
    sanitized = sanitized.replace(/onload/gi, '');
    sanitized = sanitized.replace(/onerror/gi, '');
    
    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  };

  // Email validation with enhanced security
  const validateEmail = (email: string): { isValid: boolean; error?: string } => {
    const sanitizedEmail = sanitizeInput(email, 254);
    
    // Basic format validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(sanitizedEmail)) {
      return { isValid: false, error: 'Formato de e-mail inválido' };
    }

    // Check for suspicious patterns
    if (sanitizedEmail.includes('..') || sanitizedEmail.startsWith('.') || sanitizedEmail.endsWith('.')) {
      return { isValid: false, error: 'E-mail contém caracteres suspeitos' };
    }

    return { isValid: true };
  };

  return {
    validatePassword,
    checkRateLimit,
    recordFailedAttempt,
    resetRateLimit,
    logSecurityEvent,
    sanitizeInput,
    validateEmail,
    rateLimitState
  };
};