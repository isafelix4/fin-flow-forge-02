import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Category {
  id: number;
  name: string;
  subcategories?: Subcategory[];
}

interface Subcategory {
  id: number;
  name: string;
  category_id: number;
}

interface BudgetItem {
  category_id: number;
  subcategory_id: number | null;
  category_name: string;
  subcategory_name?: string;
}

interface AddBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planType: 'RECEITA' | 'DESPESA';
  onAddItem: (item: BudgetItem) => Promise<void>;
  existingBudgets: Array<{ category_id: number; subcategory_id: number | null; plan_type: string }>;
}

export function AddBudgetModal({ open, onOpenChange, planType, onAddItem, existingBudgets }: AddBudgetModalProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    if (open && user) {
      loadCategories();
    }
  }, [open, user]);

  const loadCategories = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select(`
          id,
          name,
          subcategories (
            id,
            name,
            category_id
          )
        `)
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateOptions = () => {
    const options: Array<BudgetItem & { display: string; searchTerms: string }> = [];

    categories.forEach(category => {
      // Check if this category (without subcategory) already exists
      const categoryExists = existingBudgets.some(b => 
        b.category_id === category.id && 
        b.subcategory_id === null && 
        b.plan_type === planType
      );

      if (!categoryExists) {
        options.push({
          category_id: category.id,
          subcategory_id: null,
          category_name: category.name,
          display: category.name,
          searchTerms: category.name.toLowerCase()
        });
      }

      // Add subcategories
      category.subcategories?.forEach(subcategory => {
        const subcategoryExists = existingBudgets.some(b => 
          b.category_id === category.id && 
          b.subcategory_id === subcategory.id && 
          b.plan_type === planType
        );

        if (!subcategoryExists) {
          options.push({
            category_id: category.id,
            subcategory_id: subcategory.id,
            category_name: category.name,
            subcategory_name: subcategory.name,
            display: `${category.name} → ${subcategory.name}`,
            searchTerms: `${category.name} ${subcategory.name}`.toLowerCase()
          });
        }
      });
    });

    return options;
  };

  const filteredOptions = generateOptions().filter(option =>
    option.searchTerms.includes(searchValue.toLowerCase())
  );

  const handleSelectItem = async (item: BudgetItem) => {
    try {
      await onAddItem(item);
      onOpenChange(false);
      setSearchValue('');
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Adicionar {planType === 'RECEITA' ? 'Receita' : 'Despesa'} Planejada
          </DialogTitle>
        </DialogHeader>
        
        <Command className="border rounded-lg">
          <CommandInput 
            placeholder="Buscar categoria ou subcategoria..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                <CommandGroup>
                  {filteredOptions.map((option, index) => (
                    <CommandItem
                      key={`${option.category_id}-${option.subcategory_id || 'null'}`}
                      onSelect={() => handleSelectItem(option)}
                      className="cursor-pointer"
                    >
                      <span>{option.display}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}