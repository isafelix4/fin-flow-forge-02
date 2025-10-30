import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

export interface CategoryInsight {
  categoryId: number;
  categoryName: string;
  currentAmount: number;
  averageAmount: number;
  variation: number;
  absoluteDiff: number;
  severity: 'critical' | 'high' | 'medium';
}

interface InsightsCardProps {
  insights: CategoryInsight[];
  loading: boolean;
}

export const InsightsCard: React.FC<InsightsCardProps> = ({ insights, loading }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getSeverityColor = (severity: 'critical' | 'high' | 'medium') => {
    switch (severity) {
      case 'critical':
        return 'bg-destructive text-destructive-foreground hover:bg-destructive/80';
      case 'high':
        return 'bg-orange-500 text-white hover:bg-orange-600';
      case 'medium':
        return 'bg-yellow-500 text-white hover:bg-yellow-600';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getSeverityLabel = (severity: 'critical' | 'high' | 'medium') => {
    switch (severity) {
      case 'critical':
        return 'Crítico';
      case 'high':
        return 'Alto';
      case 'medium':
        return 'Médio';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Insights do Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Carregando análise...</p>
        </CardContent>
      </Card>
    );
  }

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
            key={insight.categoryId}
            className="flex items-start justify-between p-3 rounded-lg bg-background border border-border"
          >
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{insight.categoryName}</p>
                <Badge variant="destructive" className={getSeverityColor(insight.severity)}>
                  {getSeverityLabel(insight.severity)}
                </Badge>
              </div>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="text-foreground font-semibold">
                  {formatCurrency(insight.currentAmount)}
                </span>
                <span className="text-muted-foreground">
                  vs {formatCurrency(insight.averageAmount)} (média)
                </span>
              </div>
              <p className="text-xs text-destructive font-medium">
                +{insight.variation.toFixed(0)}% acima da média
                {insight.absoluteDiff > 0 && ` (+${formatCurrency(insight.absoluteDiff)})`}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
