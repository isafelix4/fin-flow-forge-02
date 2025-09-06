import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSecurityValidation } from '@/hooks/useSecurityValidation';
import { CheckCircle, XCircle, Shield } from 'lucide-react';

const Cadastro = () => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    confirmarSenha: '',
  });
  const [loading, setLoading] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState<any>(null);
  const navigate = useNavigate();
  const { validatePassword, validateEmail, sanitizeInput, logSecurityEvent, checkRateLimit, recordFailedAttempt } = useSecurityValidation();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const sanitizedValue = name === 'nome' ? sanitizeInput(value, 100) : value;
    
    setFormData({
      ...formData,
      [name]: sanitizedValue,
    });

    // Real-time password validation
    if (name === 'senha') {
      const validation = validatePassword(value);
      setPasswordValidation(validation);
    }
  };

  const validateForm = () => {
    if (!formData.nome.trim()) {
      toast({
        title: "Erro de validação",
        description: "Nome é obrigatório",
        variant: "destructive",
      });
      return false;
    }
    
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      toast({
        title: "Erro de validação",
        description: emailValidation.error || "Digite um e-mail válido",
        variant: "destructive",
      });
      return false;
    }
    
    const passwordValidation = validatePassword(formData.senha);
    if (!passwordValidation.isValid) {
      toast({
        title: "Erro de validação",
        description: passwordValidation.errors.join(', '),
        variant: "destructive",
      });
      return false;
    }
    
    if (formData.senha !== formData.confirmarSenha) {
      toast({
        title: "Erro de validação",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!checkRateLimit()) return;
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.senha,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            nome: formData.nome,
          }
        }
      });

      if (error) {
        recordFailedAttempt();
        await logSecurityEvent('signup_failed', { 
          error: error.message,
          email: formData.email 
        });

        if (error.message.includes('User already registered')) {
          toast({
            title: "Erro no cadastro",
            description: "Este e-mail já está cadastrado. Tente fazer login.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro no cadastro",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      if (data.user && !data.session) {
        await logSecurityEvent('signup_success', { 
          user_id: data.user.id,
          email: data.user.email 
        });
        
        toast({
          title: "Cadastro realizado!",
          description: "Verifique seu e-mail para confirmar o cadastro antes de fazer login.",
        });
        navigate('/login');
      } else if (data.session) {
        await logSecurityEvent('signup_auto_login', { 
          user_id: data.user?.id,
          email: data.user?.email 
        });
        navigate('/');
      }
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro durante o cadastro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Criar Conta</CardTitle>
          <CardDescription>
            Crie sua conta na plataforma de gestão financeira
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                name="nome"
                type="text"
                placeholder="Digite seu nome completo"
                value={formData.nome}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Digite seu e-mail"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                name="senha"
                type="password"
                placeholder="Digite sua senha"
                value={formData.senha}
                onChange={handleChange}
                required
              />
              {passwordValidation && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Shield size={16} />
                    <span className={`font-medium ${
                      passwordValidation.strength === 'strong' ? 'text-green-600' :
                      passwordValidation.strength === 'medium' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      Força: {passwordValidation.strength === 'strong' ? 'Forte' :
                               passwordValidation.strength === 'medium' ? 'Média' : 'Fraca'}
                    </span>
                  </div>
                  {passwordValidation.errors.map((error: string, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-red-600">
                      <XCircle size={12} />
                      <span>{error}</span>
                    </div>
                  ))}
                  {passwordValidation.isValid && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle size={12} />
                      <span>Senha segura!</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmarSenha">Confirmar Senha</Label>
              <Input
                id="confirmarSenha"
                name="confirmarSenha"
                type="password"
                placeholder="Confirme sua senha"
                value={formData.confirmarSenha}
                onChange={handleChange}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Entre
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Cadastro;