import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User, Home, CreditCard, FolderOpen, TrendingUp, Wallet, ArrowLeftRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const Header = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: 'Início', href: '/', icon: Home },
    { name: 'Contas', href: '/contas', icon: CreditCard },
    { name: 'Categorias', href: '/categorias', icon: FolderOpen },
    { name: 'Transações', href: '/transacoes', icon: ArrowLeftRight },
    { name: 'Investimentos', href: '/investimentos', icon: TrendingUp },
    { name: 'Dívidas', href: '/dividas', icon: Wallet },
  ];

  return (
    <header className="border-b bg-card">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center space-x-8">
          <Link to="/">
            <h1 className="text-xl font-bold text-primary hover:text-primary/80 transition-colors">
              Gestão Financeira Pessoal
            </h1>
          </Link>
          
          {user && (
            <nav className="hidden md:flex items-center space-x-6">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
        
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {user.user_metadata?.nome || user.email}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={signOut} className="flex items-center gap-2 text-destructive">
                <LogOut className="h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
};