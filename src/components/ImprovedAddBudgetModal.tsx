import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Category {
  id: number;
  name: string;
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

interface ImprovedAddBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planType: 'RECEITA' | 'DESPESA';
  onAddItem: (item: BudgetItem) => Promise<void>;
  existingBudgets: Array<{ category_id: number; subcategory_id: number | null; plan_type: string }>;
}

export function ImprovedAddBudgetModal({ open, onOpenChange, planType, onAddItem, existingBudgets }: ImprovedAddBudgetModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      loadCategories();
    }
  }, [open, user]);

  useEffect(() => {
    if (selectedCategoryId) {
      loadSubcategories(parseInt(selectedCategoryId));
    } else {
      setSubcategories([]);
      setSelectedSubcategoryId('');
    }
  }, [selectedCategoryId]);

  const loadCategories = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar categorias",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSubcategories = async (categoryId: number) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('id, name, category_id')
        .eq('category_id', categoryId)
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setSubcategories(data || []);
    } catch (error) {
      console.error('Erro ao carregar subcategorias:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar subcategorias",
        variant: "destructive"
      });
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedSubcategoryId('');
  };

  const handleAdd = async () => {
    if (!selectedCategoryId) {
      toast({
        title: "Erro",
        description: "Selecione uma categoria",
        variant: "destructive"
      });
      return;
    }

    const categoryId = parseInt(selectedCategoryId);
    const subcategoryId = selectedSubcategoryId ? parseInt(selectedSubcategoryId) : null;

    // Check if this combination already exists
    const exists = existingBudgets.some(b => 
      b.category_id === categoryId && 
      b.subcategory_id === subcategoryId && 
      b.plan_type === planType
    );

    if (exists) {
      toast({
        title: "Erro",
        description: "Este item já foi adicionado ao planejamento",
        variant: "destructive"
      });
      return;
    }

    const selectedCategory = categories.find(c => c.id === categoryId);
    const selectedSubcategory = subcategories.find(s => s.id === subcategoryId);

    const item: BudgetItem = {
      category_id: categoryId,
      subcategory_id: subcategoryId,
      category_name: selectedCategory?.name || '',
      subcategory_name: selectedSubcategory?.name
    };

    try {
      await onAddItem(item);
      // Reset form
      setSelectedCategoryId('');
      setSelectedSubcategoryId('');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
    }
  };

  const availableCategories = categories.filter(category => {
    // Show categories that either don't have any budget items or have room for subcategories
    const categoryBudgets = existingBudgets.filter(b => 
      b.category_id === category.id && b.plan_type === planType
    );
    
    // If no budgets for this category, it's available
    if (categoryBudgets.length === 0) return true;
    
    // If there are budgets, check if there are still available subcategories
    const usedSubcategoryIds = categoryBudgets.map(b => b.subcategory_id);
    const hasMainCategory = usedSubcategoryIds.includes(null);
    
    // If main category is not used, category is available
    if (!hasMainCategory) return true;
    
    // Check if there are unused subcategories
    const categorySubcategories = subcategories.filter(s => s.category_id === category.id);
    const hasUnusedSubcategories = categorySubcategories.some(s => !usedSubcategoryIds.includes(s.id));
    
    return hasUnusedSubcategories;
  });

  const availableSubcategories = subcategories.filter(subcategory => {
    return !existingBudgets.some(b => 
      b.category_id === parseInt(selectedCategoryId) && 
      b.subcategory_id === subcategory.id && 
      b.plan_type === planType
    );
  });

  const isCategoryWithoutSubcategoryAvailable = selectedCategoryId && !existingBudgets.some(b => 
    b.category_id === parseInt(selectedCategoryId) && 
    b.subcategory_id === null && 
    b.plan_type === planType
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Adicionar {planType === 'RECEITA' ? 'Receita' : 'Despesa'} Planejada
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select value={selectedCategoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCategoryId && (
            <div className="space-y-2">
              <Label>Subcategoria</Label>
              <Select value={selectedSubcategoryId} onValueChange={setSelectedSubcategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma subcategoria (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {isCategoryWithoutSubcategoryAvailable && (
                    <SelectItem value="">Usar apenas a categoria principal</SelectItem>
                  )}
                  {availableSubcategories.map((subcategory) => (
                    <SelectItem key={subcategory.id} value={subcategory.id.toString()}>
                      {subcategory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAdd} disabled={!selectedCategoryId || loading}>
            Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}