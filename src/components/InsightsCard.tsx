import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';
import { useCategoryInsights } from '@/features/insights/useCategoryInsights';

interface InsightsCardProps {
  refMonth: Date;
}

export const InsightsCard: React.FC<InsightsCardProps> = ({ refMonth }) => {
  const { data, isLoading, error } = useCategoryInsights(refMonth);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getSeverityColor = (severity: 'critico' | 'alto' | 'medio' | null) => {
    switch (severity) {
      case 'critico':
        return 'bg-destructive text-destructive-foreground hover:bg-destructive/80';
      case 'alto':
        return 'bg-orange-500 text-white hover:bg-orange-600';
      case 'medio':
        return 'bg-yellow-500 text-white hover:bg-yellow-600';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getSeverityLabel = (severity: 'critico' | 'alto' | 'medio' | null) => {
    switch (severity) {
      case 'critico':
        return 'Crítico';
      case 'alto':
        return 'Alto';
      case 'medio':
        return 'Médio';
      default:
        return 'OK';
    }
  };

  if (isLoading) {
    return (
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Insights do Mês
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Erro ao Carregar Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Não foi possível carregar os insights do mês.
          </p>
        </CardContent>
      </Card>
    );
  }

  const insights = (data ?? []).filter(r => r.severity !== null);

  if (insights.length === 0) {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-green-600">
            <AlertTriangle className="h-5 w-5" />
            Insights do Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">
            ✅ Nenhum ponto de atenção identificado. Seus gastos estão controlados!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Pontos de Atenção
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Categorias com gastos elevados neste mês
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight) => (
          <div
            key={insight.category_id}
            className="flex items-start justify-between p-3 rounded-lg bg-background border border-border"
          >
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">
                  {insight.category_name ?? 'Sem nome'}
                </p>
                <Badge variant="destructive" className={getSeverityColor(insight.severity)}>
                  {getSeverityLabel(insight.severity)}
                </Badge>
              </div>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="text-foreground font-semibold">
                  {formatCurrency(insight.current_expense)}
                </span>
                <span className="text-muted-foreground">
                  vs {formatCurrency(insight.prev3_avg_expense)} (média 3m)
                </span>
              </div>
              {insight.deviation_pct !== null && insight.prev3_avg_expense > 0 ? (
                <p className="text-xs text-destructive font-medium">
                  +{(insight.deviation_pct * 100).toFixed(0)}% acima da média
                  {insight.deviation_pct > 0 && 
                    ` (+${formatCurrency(insight.current_expense - insight.prev3_avg_expense)})`
                  }
                </p>
              ) : insight.prev3_avg_expense === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sem histórico para comparação
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
