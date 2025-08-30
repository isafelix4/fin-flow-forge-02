import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const planejamentoSchema = z.object({
  category_id: z.number().min(1, "Categoria é obrigatória"),
  subcategory_id: z.number().optional(),
  planned_amount: z.number().min(0.01, "Valor planejado é obrigatório"),
});

type PlanejamentoFormData = z.infer<typeof planejamentoSchema>;

interface PlanejamentoItem {
  id: number;
  category_id: number;
  subcategory_id: number | null;
  planned_amount: number;
  plan_type: 'RECEITA' | 'DESPESA';
  category_name: string;
  subcategory_name?: string;
  realizado: number;
}

interface Category {
  id: number;
  name: string;
}

interface Subcategory {
  id: number;
  name: string;
  category_id: number;
}

interface PlanejamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'RECEITA' | 'DESPESA';
  editingItem: PlanejamentoItem | null;
  referenceMonth: string;
  onSaved: () => void;
}

export const PlanejamentoModal: React.FC<PlanejamentoModalProps> = ({
  isOpen,
  onClose,
  type,
  editingItem,
  referenceMonth,
  onSaved,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | null>(null);
  const [plannedAmount, setPlannedAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const {
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<PlanejamentoFormData>({
    resolver: zodResolver(planejamentoSchema),
  });

  // Load categories when modal opens
  useEffect(() => {
    if (isOpen) {
      loadCategories();
      resetForm();
      
      // Pre-populate form if editing
      if (editingItem) {
        setSelectedCategoryId(editingItem.category_id);
        setSelectedSubcategoryId(editingItem.subcategory_id);
        setPlannedAmount(editingItem.planned_amount.toString());
        // Load subcategories for the selected category
        if (editingItem.category_id) {
          loadSubcategories(editingItem.category_id);
        }
      }
    }
  }, [isOpen, editingItem]);

  const resetForm = () => {
    setSelectedCategoryId(null);
    setSelectedSubcategoryId(null);
    setPlannedAmount('');
    setSubcategories([]);
    clearErrors();
  };

  const loadCategories = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as categorias.",
        variant: "destructive"
      });
    }
  };

  const loadSubcategories = async (categoryId: number) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('id, name, category_id')
        .eq('user_id', user.id)
        .eq('category_id', categoryId)
        .order('name');

      if (error) throw error;
      setSubcategories(data || []);
    } catch (error) {
      console.error('Error loading subcategories:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as subcategorias.",
        variant: "destructive"
      });
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    const id = parseInt(categoryId);
    setSelectedCategoryId(id);
    setSelectedSubcategoryId(null); // Reset subcategory when category changes
    loadSubcategories(id);
    clearErrors();
  };

  const handleSubcategoryChange = (subcategoryId: string) => {
    setSelectedSubcategoryId(subcategoryId ? parseInt(subcategoryId) : null);
    clearErrors();
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlannedAmount(e.target.value);
    clearErrors();
  };

  const validateAndSubmit = () => {
    // Clear previous errors
    clearErrors();

    // Manual validation
    const amount = parseFloat(plannedAmount.replace(',', '.'));
    
    if (!selectedCategoryId) {
      setError('category_id', { message: 'Categoria é obrigatória' });
      return;
    }
    
    if (!plannedAmount || isNaN(amount) || amount <= 0) {
      setError('planned_amount', { message: 'Valor planejado é obrigatório e deve ser maior que zero' });
      return;
    }

    // If validation passes, call the submit function
    handleSubmit(() => onSubmit({
      category_id: selectedCategoryId,
      subcategory_id: selectedSubcategoryId || undefined,
      planned_amount: amount,
    }))();
  };

  const onSubmit = async (data: PlanejamentoFormData) => {
    if (!user) return;

    try {
      setLoading(true);

      const budgetData = {
        user_id: user.id,
        category_id: data.category_id,
        subcategory_id: data.subcategory_id || null,
        planned_amount: data.planned_amount,
        plan_type: type,
        reference_month: referenceMonth,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('budgets')
          .update(budgetData)
          .eq('id', editingItem.id);

        if (error) throw error;

        toast({
          title: "Planejamento atualizado",
          description: "O planejamento foi atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('budgets')
          .insert([budgetData]);

        if (error) throw error;

        toast({
          title: "Planejamento criado",
          description: "O planejamento foi criado com sucesso.",
        });
      }

      onSaved();
    } catch (error) {
      console.error('Error saving budget:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar o planejamento.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? 'Editar' : 'Adicionar'} Planejamento de {type === 'RECEITA' ? 'Receita' : 'Despesa'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category_id">Categoria *</Label>
            <Select 
              value={selectedCategoryId?.toString() || ''} 
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category_id && (
              <p className="text-sm text-destructive">{errors.category_id.message}</p>
            )}
          </div>

          {selectedCategoryId && subcategories.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="subcategory_id">Subcategoria</Label>
              <Select 
                value={selectedSubcategoryId?.toString() || ''} 
                onValueChange={handleSubcategoryChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma subcategoria (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma subcategoria</SelectItem>
                  {subcategories.map((subcategory) => (
                    <SelectItem key={subcategory.id} value={subcategory.id.toString()}>
                      {subcategory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="planned_amount">Valor Planejado *</Label>
            <Input
              id="planned_amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={plannedAmount}
              onChange={handleAmountChange}
            />
            {errors.planned_amount && (
              <p className="text-sm text-destructive">{errors.planned_amount.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={validateAndSubmit} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Planejamento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};