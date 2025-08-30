// src/components/PlanejamentoModal.tsx - VERSÃO CORRIGIDA E MELHORADA

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// 1. Centralizar o Schema e Tipos:
//    - Define um schema de validação robusto com o Zod.
//    - O tipo do formulário é inferido diretamente do schema, garantindo consistência.
const planejamentoSchema = z.object({
  category_id: z.string().min(1, "Categoria é obrigatória"),
  subcategory_id: z.string().optional().nullable(),
  planned_amount: z.string().min(1, "Valor planejado é obrigatório").refine(val => !isNaN(parseFloat(val.replace(',', '.'))) && parseFloat(val.replace(',', '.')) > 0, {
    message: "O valor deve ser um número maior que zero.",
  }),
});

type PlanejamentoFormData = z.infer<typeof planejamentoSchema>;

// ... (interfaces Category, Subcategory, etc. permanecem as mesmas) ...
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
  const [loading, setLoading] = useState(false);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);

  // 2. Usar React Hook Form:
  //    - Gerencia o estado do formulário de forma eficiente (setValue, watch, handleSubmit).
  //    - Integra-se perfeitamente com o Zod para validação.
  //    - Simplifica o gerenciamento de erros.
  const {
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PlanejamentoFormData>({
    resolver: zodResolver(planejamentoSchema),
    defaultValues: {
      category_id: '',
      subcategory_id: null,
      planned_amount: '',
    },
  });

  const watchedCategoryId = watch("category_id");

  // 3. Efeito para carregar dados e popular o formulário (corrigido):
  //    - O `useEffect` agora só depende de `editingItem.id`, que é um valor primitivo e estável.
  //    - A lógica de popular o formulário (`reset`) é mais limpa e eficiente.
  useEffect(() => {
    if (isOpen) {
      loadCategories();
      if (editingItem) {
        reset({
          category_id: String(editingItem.category_id),
          subcategory_id: editingItem.subcategory_id ? String(editingItem.subcategory_id) : null,
          planned_amount: String(editingItem.planned_amount),
        });
      } else {
        reset(); // Limpa o formulário para uma nova entrada
      }
    }
  }, [isOpen, editingItem?.id, reset]);

  // 4. Efeito para buscar subcategorias (otimizado):
  //    - Reage apenas à mudança do `watchedCategoryId`.
  //    - Limpa a seleção de subcategoria sempre que a categoria principal muda.
  useEffect(() => {
    if (watchedCategoryId) {
      setValue("subcategory_id", null); // Reseta a subcategoria ao mudar a categoria
      loadSubcategories(Number(watchedCategoryId));
    } else {
      setSubcategories([]);
    }
  }, [watchedCategoryId, setValue]);

  const loadCategories = async () => {
    // ... (lógica de loadCategories permanece a mesma) ...
  };

  const loadSubcategories = async (categoryId: number) => {
    // ... (lógica de loadSubcategories permanece a mesma) ...
  };
  
  const onSubmit = async (data: PlanejamentoFormData) => {
    if (!user) return;

    try {
      setLoading(true);

      const budgetData = {
        user_id: user.id,
        category_id: Number(data.category_id),
        subcategory_id: data.subcategory_id ? Number(data.subcategory_id) : null,
        planned_amount: parseFloat(data.planned_amount.replace(',', '.')),
        plan_type: type,
        reference_month: referenceMonth,
      };

      const { error } = editingItem
        ? await supabase.from('budgets').update(budgetData).eq('id', editingItem.id)
        : await supabase.from('budgets').insert([budgetData]);

      if (error) throw error;

      toast({
        title: `Planejamento ${editingItem ? 'atualizado' : 'criado'}`,
        description: `O planejamento foi ${editingItem ? 'atualizado' : 'criado'} com sucesso.`,
      });

      onSaved();
      onClose(); // Fecha o modal após salvar

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
        {/* 5. Formulário controlado pelo React Hook Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Controller
              name="category_id"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.category_id && <p className="text-sm text-destructive">{errors.category_id.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Subcategoria</Label>
            <Controller
              name="subcategory_id"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={!watchedCategoryId || loadingSubcategories}>
                  <SelectTrigger><SelectValue placeholder={loadingSubcategories ? "Carregando..." : "Selecione (opcional)"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {subcategories.map((sub) => <SelectItem key={sub.id} value={String(sub.id)}>{sub.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Valor Planejado *</Label>
            <Controller
              name="planned_amount"
              control={control}
              render={({ field }) => <Input {...field} type="text" placeholder="0,00" />}
            />
            {errors.planned_amount && <p className="text-sm text-destructive">{errors.planned_amount.message}</p>}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
