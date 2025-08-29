import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { FloatingTransactionButton } from '@/components/FloatingTransactionButton';

import { Database } from '@/integrations/supabase/types';

interface Category {
  id: number;
  name: string;
  type: Database['public']['Enums']['category_type'];
  created_at: string;
  subcategories?: Subcategory[];
}

interface Subcategory {
  id: number;
  name: string;
  category_id: number;
  created_at: string;
}

const CATEGORY_TYPES = [
  { value: 'Standard', label: 'Padrão' },
  { value: 'Debt', label: 'Dívidas' },
  { value: 'Investment', label: 'Investimentos' }
];

export default function Categorias() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryFormData, setCategoryFormData] = useState<{
    name: string;
    type: Database['public']['Enums']['category_type'];
  }>({
    name: '',
    type: 'Standard'
  });
  const [subcategoryFormData, setSubcategoryFormData] = useState({
    name: ''
  });

  useEffect(() => {
    if (user) {
      fetchCategoriesWithSubcategories();
    }
  }, [user]);

  const fetchCategoriesWithSubcategories = async () => {
    try {
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (categoriesError) throw categoriesError;

      const { data: subcategoriesData, error: subcategoriesError } = await supabase
        .from('subcategories')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (subcategoriesError) throw subcategoriesError;

      const categoriesWithSubcategories = categoriesData?.map(category => ({
        ...category,
        subcategories: subcategoriesData?.filter(sub => sub.category_id === category.id) || []
      })) || [];

      setCategories(categoriesWithSubcategories);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar categorias",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryFormData.name) {
      toast({
        title: "Erro",
        description: "Nome da categoria é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: categoryFormData.name,
            type: categoryFormData.type
          })
          .eq('id', editingCategory.id)
          .eq('user_id', user?.id);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Categoria atualizada com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('categories')
          .insert([{
            name: categoryFormData.name,
            type: categoryFormData.type,
            user_id: user?.id
          }]);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Categoria criada com sucesso"
        });
      }

      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      setCategoryFormData({ name: '', type: 'Standard' });
      fetchCategoriesWithSubcategories();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar categoria",
        variant: "destructive"
      });
    }
  };

  const handleSubcategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subcategoryFormData.name || !selectedCategoryId) {
      toast({
        title: "Erro",
        description: "Nome da subcategoria é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingSubcategory) {
        const { error } = await supabase
          .from('subcategories')
          .update({
            name: subcategoryFormData.name
          })
          .eq('id', editingSubcategory.id)
          .eq('user_id', user?.id);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Subcategoria atualizada com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('subcategories')
          .insert([{
            name: subcategoryFormData.name,
            category_id: selectedCategoryId,
            user_id: user?.id
          }]);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Subcategoria criada com sucesso"
        });
      }

      setIsSubcategoryModalOpen(false);
      setEditingSubcategory(null);
      setSelectedCategoryId(null);
      setSubcategoryFormData({ name: '' });
      fetchCategoriesWithSubcategories();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar subcategoria",
        variant: "destructive"
      });
    }
  };

  const handleCategoryEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      type: category.type as Database['public']['Enums']['category_type']
    });
    setIsCategoryModalOpen(true);
  };

  const handleSubcategoryEdit = (subcategory: Subcategory) => {
    setEditingSubcategory(subcategory);
    setSelectedCategoryId(subcategory.category_id);
    setSubcategoryFormData({
      name: subcategory.name
    });
    setIsSubcategoryModalOpen(true);
  };

  const handleCategoryDelete = async (category: Category) => {
    try {
      // Update transactions to set category_id to NULL
      await supabase
        .from('transactions')
        .update({ category_id: null })
        .eq('category_id', category.id)
        .eq('user_id', user?.id);

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Categoria excluída com sucesso"
      });
      
      fetchCategoriesWithSubcategories();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir categoria",
        variant: "destructive"
      });
    }
  };

  const handleSubcategoryDelete = async (subcategory: Subcategory) => {
    try {
      // Update transactions to set subcategory_id to NULL
      await supabase
        .from('transactions')
        .update({ subcategory_id: null })
        .eq('subcategory_id', subcategory.id)
        .eq('user_id', user?.id);

      const { error } = await supabase
        .from('subcategories')
        .delete()
        .eq('id', subcategory.id)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Subcategoria excluída com sucesso"
      });
      
      fetchCategoriesWithSubcategories();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir subcategoria",
        variant: "destructive"
      });
    }
  };

  const resetCategoryForm = () => {
    setCategoryFormData({ name: '', type: 'Standard' });
    setEditingCategory(null);
  };

  const resetSubcategoryForm = () => {
    setSubcategoryFormData({ name: '' });
    setEditingSubcategory(null);
    setSelectedCategoryId(null);
  };

  const getTypeLabel = (type: string) => {
    return CATEGORY_TYPES.find(t => t.value === type)?.label || type;
  };

  const handleAddSubcategory = (categoryId: number) => {
    setSelectedCategoryId(categoryId);
    setIsSubcategoryModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Minhas Categorias</h1>
        <Dialog open={isCategoryModalOpen} onOpenChange={(open) => {
          setIsCategoryModalOpen(open);
          if (!open) resetCategoryForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <Label htmlFor="categoryName">Nome da Categoria *</Label>
                <Input
                  id="categoryName"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  placeholder="Ex: Alimentação"
                  required
                />
              </div>
              <div>
                <Label htmlFor="categoryType">Tipo de Categoria</Label>
                <Select 
                  value={categoryFormData.type} 
                  onValueChange={(value: Database['public']['Enums']['category_type']) => 
                    setCategoryFormData({ ...categoryFormData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCategoryModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingCategory ? 'Atualizar Categoria' : 'Salvar Categoria'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isSubcategoryModalOpen} onOpenChange={(open) => {
        setIsSubcategoryModalOpen(open);
        if (!open) resetSubcategoryForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSubcategory ? 'Editar Subcategoria' : 'Nova Subcategoria'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubcategorySubmit} className="space-y-4">
            <div>
              <Label htmlFor="subcategoryName">Nome da Subcategoria *</Label>
              <Input
                id="subcategoryName"
                value={subcategoryFormData.name}
                onChange={(e) => setSubcategoryFormData({ ...subcategoryFormData, name: e.target.value })}
                placeholder="Ex: Restaurantes"
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsSubcategoryModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingSubcategory ? 'Atualizar Subcategoria' : 'Salvar Subcategoria'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {categories.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            Nenhuma categoria cadastrada. Clique em "Nova Categoria" para começar.
          </p>
        </div>
      ) : (
        <Accordion type="multiple" className="w-full">
          {categories.map((category) => (
            <AccordionItem key={category.id} value={`category-${category.id}`}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center space-x-3">
                    <span className="font-medium">{category.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({getTypeLabel(category.type)})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCategoryEdit(category);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir a categoria "{category.name}"? 
                            As transações já associadas a ela não serão excluídas, mas ficarão sem categoria.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleCategoryDelete(category)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pl-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddSubcategory(category.id)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Subcategoria
                  </Button>
                  
                  {category.subcategories && category.subcategories.length > 0 ? (
                    <div className="space-y-2">
                      {category.subcategories.map((subcategory) => (
                        <div key={subcategory.id} className="flex items-center justify-between p-3 border rounded-md">
                          <span>{subcategory.name}</span>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSubcategoryEdit(subcategory)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir a subcategoria "{subcategory.name}"?
                                    As transações já associadas a ela não serão excluídas, mas ficarão sem subcategoria.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleSubcategoryDelete(subcategory)}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma subcategoria cadastrada.
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
      </div>
      <FloatingTransactionButton />
    </div>
  );
}