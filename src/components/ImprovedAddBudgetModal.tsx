import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

interface ImprovedAddBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planType: 'RECEITA' | 'DESPESA';
  onAddItem: (item: BudgetItem) => Promise<void>;
  existingBudgets: Array<{ category_id: number; subcategory_id: number | null; plan_type: string }>;
  categories: Category[];
}

export function ImprovedAddBudgetModal({ open, onOpenChange, planType, onAddItem, existingBudgets, categories }: ImprovedAddBudgetModalProps) {
  const { toast } = useToast();
  const [view, setView] = useState<'categories' | 'subcategories'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [searchValue, setSearchValue] = useState('');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setView('categories');
      setSelectedCategory(null);
      setSearchValue('');
    }
  }, [open]);

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setSearchValue('');
    
    // Check if category has available subcategories
    const categorySubcategories = category.subcategories || [];
    const hasAvailableSubcategories = categorySubcategories.some(sub => 
      !existingBudgets.some(b => 
        b.category_id === category.id && 
        b.subcategory_id === sub.id && 
        b.plan_type === planType
      )
    );

    // Check if main category is available
    const isCategoryAvailable = !existingBudgets.some(b => 
      b.category_id === category.id && 
      b.subcategory_id === null && 
      b.plan_type === planType
    );

    // If only main category is available or no subcategories, add directly
    if (!hasAvailableSubcategories && isCategoryAvailable) {
      handleItemAdd(category.id, null, category.name);
    } else if (hasAvailableSubcategories) {
      setView('subcategories');
    } else {
      // Nothing available for this category
      toast({
        title: "Aviso",
        description: "Esta categoria já foi completamente adicionada ao planejamento",
        variant: "destructive"
      });
    }
  };

  const handleSubcategorySelect = (subcategoryId: number, subcategoryName: string) => {
    if (!selectedCategory) return;
    handleItemAdd(selectedCategory.id, subcategoryId, selectedCategory.name, subcategoryName);
  };

  const handleItemAdd = async (categoryId: number, subcategoryId: number | null, categoryName: string, subcategoryName?: string) => {
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

    const item: BudgetItem = {
      category_id: categoryId,
      subcategory_id: subcategoryId,
      category_name: categoryName,
      subcategory_name: subcategoryName
    };

    try {
      await onAddItem(item);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
    }
  };

  // Get available categories that have either main category or subcategories available
  const getAvailableCategories = () => {
    return categories.filter(category => {
      const categoryBudgets = existingBudgets.filter(b => 
        b.category_id === category.id && b.plan_type === planType
      );
      
      // If no budgets for this category, it's available
      if (categoryBudgets.length === 0) return true;
      
      // Check if main category is used
      const usedSubcategoryIds = categoryBudgets.map(b => b.subcategory_id);
      const hasMainCategory = usedSubcategoryIds.includes(null);
      
      // If main category is not used, category is available
      if (!hasMainCategory) return true;
      
      // Check if there are unused subcategories
      const categorySubcategories = category.subcategories || [];
      const hasUnusedSubcategories = categorySubcategories.some(s => !usedSubcategoryIds.includes(s.id));
      
      return hasUnusedSubcategories;
    }).filter(category => 
      category.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  };

  // Get available subcategories for selected category
  const getAvailableSubcategories = () => {
    if (!selectedCategory) return [];
    
    const categorySubcategories = selectedCategory.subcategories || [];
    return categorySubcategories.filter(subcategory => {
      const isNotUsed = !existingBudgets.some(b => 
        b.category_id === selectedCategory.id && 
        b.subcategory_id === subcategory.id && 
        b.plan_type === planType
      );
      
      return isNotUsed && subcategory.name.toLowerCase().includes(searchValue.toLowerCase());
    });
  };

  // Check if main category is available for selected category
  const isCategoryWithoutSubcategoryAvailable = () => {
    if (!selectedCategory) return false;
    
    return !existingBudgets.some(b => 
      b.category_id === selectedCategory.id && 
      b.subcategory_id === null && 
      b.plan_type === planType
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {view === 'subcategories' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('categories')}
                className="h-6 w-6 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {view === 'categories' ? (
              <>Adicionar {planType === 'RECEITA' ? 'Receita' : 'Despesa'} Planejada</>
            ) : (
              <>Subcategorias de {selectedCategory?.name}</>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <Command className="rounded-lg border shadow-md">
          <CommandInput 
            placeholder={view === 'categories' ? "Buscar categorias..." : "Buscar subcategorias..."}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {view === 'categories' ? 'Nenhuma categoria encontrada.' : 'Nenhuma subcategoria encontrada.'}
            </CommandEmpty>
            
            {view === 'categories' && (
              <CommandGroup>
                {getAvailableCategories().map((category) => (
                  <CommandItem
                    key={category.id}
                    value={category.name}
                    onSelect={() => handleCategorySelect(category)}
                    className="cursor-pointer"
                  >
                    {category.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {view === 'subcategories' && selectedCategory && (
              <CommandGroup>
                {isCategoryWithoutSubcategoryAvailable() && (
                  <CommandItem
                    value="categoria-principal"
                    onSelect={() => handleItemAdd(selectedCategory.id, null, selectedCategory.name)}
                    className="cursor-pointer font-medium"
                  >
                    Usar apenas a categoria principal
                  </CommandItem>
                )}
                {getAvailableSubcategories().map((subcategory) => (
                  <CommandItem
                    key={subcategory.id}
                    value={subcategory.name}
                    onSelect={() => handleSubcategorySelect(subcategory.id, subcategory.name)}
                    className="cursor-pointer"
                  >
                    {subcategory.name}
                  </CommandItem>
                ))}
              </CommandGroup>
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