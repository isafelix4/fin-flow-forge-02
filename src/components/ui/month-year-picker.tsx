import * as React from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  parseReferenceMonth,
  buildReferenceMonth,
  formatReferenceMonth,
} from "@/lib/referenceMonth";

interface MonthYearPickerProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function MonthYearPicker({
  value,
  onValueChange,
  placeholder = "Selecione mês e ano",
  className,
}: MonthYearPickerProps) {
  const [selectedYear, setSelectedYear] = React.useState<number>(() => {
    if (value) {
      return parseReferenceMonth(value).year;
    }
    return new Date().getFullYear();
  });

  const [selectedMonth, setSelectedMonth] = React.useState<number>(() => {
    if (value) {
      return parseReferenceMonth(value).month;
    }
    return new Date().getMonth();
  });

  const [open, setOpen] = React.useState(false);

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  // Generate years from 10 years ago to 10 years in the future
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  const handleMonthYearSelect = (month: number, year: number) => {
    const dateValue = buildReferenceMonth(year, month);
    onValueChange?.(dateValue);
    setSelectedMonth(month);
    setSelectedYear(year);
    setOpen(false);
  };

  const formatDisplayValue = (val: string) => {
    return formatReferenceMonth(val);
  };

  const navigateYear = (direction: 'prev' | 'next') => {
    setSelectedYear(prev => direction === 'prev' ? prev - 1 : prev + 1);
  };

  // Determine if a month button is "active" (matches current value)
  const isMonthActive = (monthIndex: number): boolean => {
    if (!value) return false;
    const parsed = parseReferenceMonth(value);
    return parsed.year === selectedYear && parsed.month === monthIndex;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? formatDisplayValue(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          {/* Year selector with navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateYear('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateYear('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-2">
            {months.map((month, index) => (
              <Button
                key={month}
                variant={isMonthActive(index) ? "default" : "outline"}
                className="h-9 text-sm"
                onClick={() => handleMonthYearSelect(index, selectedYear)}
              >
                {month.slice(0, 3)}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
