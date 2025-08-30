// src/components/PlanejamentoModal.tsx - VERSÃO FINAL E ROBUSTA
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

const planejamentoSchema = z.object({
  category_id: z.string().min(1, "Categoria é obrigatória"),
  subcategory_id: z.string().optional().nullable(),
  planned_amount: z.string()
    .min(1, "Valor planejado é obrigatório")
    .refine(val => !isNaN(parseFloat(val.replace(',', '.'))) && parseFloat(val.replace(',', '.')) > 0, {
      message: "O valor deve ser um número maior que zero.",
    }),
});

type PlanejamentoFormData = z.infer<typeof planejamentoSchema>;

interface PlanejamentoItem {
  id: number;
  category_id: number;
  subcategory_id: number | null;
  planned_amount: number;
  plan_type: 'RECEITA' | 'DESPESA';
}

interface Category { id: number; name: string; }
interface Subcategory { id: number; name: string; category_id: number; }

interface PlanejamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'RECEITA' | 'DESPESA';
  editingItem: PlanejamentoItem | null;
  referenceMonth: string;
  onSaved: () => void;
}

export const PlanejamentoModal: React.FC<PlanejamentoModalProps> = ({
  isOpen, onClose, type, editingItem, referenceMonth, onSaved,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);

  const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<PlanejamentoFormData>({
    resolver: zodResolver(planejamentoSchema),
    defaultValues: {
      category_id: '',
      subcategory_id: '',
      planned_amount: '',
    },
  });

  const watchedCategoryId = watch("category_id");

  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        if (!user) return;
        try {
          const { data, error } = await supabase
            .from('categories')
            .select('id, name')
            .eq('user_id', user.id)
            .order('name');
          if (error) throw error;
          setCategories(data || []);

          // Se estiver editando, reseta o formulário com os valores do item
          if (editingItem) {
            reset({
              category_id: String(editingItem.category_id),
              subcategory_id: editingItem.subcategory_id ? String(editingItem.subcategory_id) : '',
              planned_amount: String(editingItem.planned_amount).replace('.', ','),
            });
          } else {
            // Se for um novo item, apenas reseta para os valores padrão
            reset();
          }
        } catch (error) {
          toast({ title: "Erro", description: "Não foi possível carregar as categorias.", variant: "destructive" });
        }
      };
      loadData();
    }
  }, [isOpen, editingItem, user, reset, toast]);

  useEffect(() => {
    const loadSubcategories = async (categoryId: number) => {
      if (!user) return;
      setLoadingSubcategories(true);
      setSubcategories([]);
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
        toast({ title: "Erro", description: "Não foi possível carregar as subcategorias.", variant: "destructive" });
      } finally {
        setLoadingSubcategories(false);
      }
    };
    
    if (watchedCategoryId) {
      // Apenas reseta a subcategoria se não for o valor inicial do modo de edição
      if (editingItem?.category_id !== Number(watchedCategoryId)) {
          setValue("subcategory_id", '');
      }
      loadSubcategories(Number(watchedCategoryId));
    } else {
      setSubcategories([]);
    }
  }, [watchedCategoryId, user, setValue, toast, editingItem]);

  const onSubmit = async (data: PlanejamentoFormData) => {
    if (!user) return;

    setLoading(true);
    try {
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

      toast({ title: `Planejamento ${editingItem ? 'atualizado' : 'criado'} com sucesso.` });
      onSaved();
    } catch (error) {
      toast({ title: "Erro ao salvar", description: "Ocorreu um erro ao salvar o planejamento.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingItem ? 'Editar' : 'Adicionar'} Planejamento de {type === 'RECEITA' ? 'Receita' : 'Despesa'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller name="category_id" control={control} render={({ field }) => (
            <div className='space-y-2'>
              <Label>Categoria *</Label>
              <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              {errors.category_id && <p className="text-sm text-destructive">{errors.category_id.message}</p>}
            </div>
          )}/>
          
          <Controller name="subcategory_id" control={control} render={({ field }) => (
            <div className='space-y-2'>
              <Label>Subcategoria</Label>
              <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={!watchedCategoryId || loadingSubcategories}>
                  <SelectTrigger><SelectValue placeholder={loadingSubcategories ? "Carregando..." : "Nenhuma"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {subcategories.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
              </Select>
            </div>
          )}/>

          <Controller name="planned_amount" control={control} render={({ field }) => (
             <div className='space-y-2'>
                <Label>Valor Planejado *</Label>
                <Input {...field} placeholder="0,00" />
                {errors.planned_amount && <p className="text-sm text-destructive">{errors.planned_amount.message}</p>}
             </div>
          )}/>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
