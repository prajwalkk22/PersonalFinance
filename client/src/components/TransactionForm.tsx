import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTransactionSchema } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateTransaction, useCategorizeTransaction } from "@/hooks/use-transactions";
import { Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

// Schema with string coercion for numbers/dates
const formSchema = insertTransactionSchema.omit({ userId: true }).extend({
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  date: z.coerce.date(),
});

type FormValues = z.infer<typeof formSchema>;

export function TransactionForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const createMutation = useCreateTransaction();
  const categorizeMutation = useCategorizeTransaction();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: 0,
      type: "expense",
      category: "Uncategorized",
      paymentMode: "cash",
      isRecurring: false,
      isTaxDeductible: false,
      date: new Date(),
    },
  });

  const description = form.watch("description");
  const amount = form.watch("amount");

  // Auto-categorize when description changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const text = description ?? "";
      if (text.length > 3) {
        categorizeMutation.mutate(
          { description: text, amount: Number(amount ?? 0) },
          {
            onSuccess: (data) => {
              form.setValue("category", data.category);
              form.setValue("isTaxDeductible", data.isTaxDeductible);
              if (data.taxCategory) {
                form.setValue("taxCategory", data.taxCategory);
              }
              toast({
                title: "AI Suggestion",
                description: `Categorized as ${data.category} (${(data.confidence * 100).toFixed(0)}% confidence)`,
              });
            },
          }
        );
      }
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [description, amount, categorizeMutation, form, toast]);

  function onSubmit(values: FormValues) {
    createMutation.mutate(values, {
      onSuccess: () => {
        toast({ title: "Transaction added successfully" });
        onSuccess();
      },
      onError: () => {
        toast({ title: "Failed to add transaction", variant: "destructive" });
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <div className="relative">
                <FormControl>
                  <Input placeholder="Uber ride, Grocery..." {...field} value={field.value || ''} />
                </FormControl>
                {categorizeMutation.isPending && (
                  <Sparkles className="absolute right-3 top-2.5 h-4 w-4 animate-pulse text-primary" />
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Food">Food</SelectItem>
                    <SelectItem value="Transport">Transport</SelectItem>
                    <SelectItem value="Shopping">Shopping</SelectItem>
                    <SelectItem value="Bills">Bills</SelectItem>
                    <SelectItem value="Health">Health</SelectItem>
                    <SelectItem value="Salary">Salary</SelectItem>
                    <SelectItem value="Investment">Investment</SelectItem>
                    <SelectItem value="Uncategorized">Uncategorized</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                    onChange={(e) => field.onChange(new Date(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isTaxDeductible"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Tax Deductible
                </FormLabel>
                <p className="text-sm text-muted-foreground">
                  Mark this if it qualifies for tax deductions (e.g. 80C)
                </p>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
          {createMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding...
            </>
          ) : (
            "Add Transaction"
          )}
        </Button>
      </form>
    </Form>
  );
}
