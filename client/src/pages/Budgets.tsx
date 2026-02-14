import { Sidebar } from "@/components/Sidebar";
import { useBudgets, useCreateBudget, useDeleteBudget, useUpdateBudget } from "@/hooks/use-budgets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBudgetSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { useMemo, useState } from "react";
import { z } from "zod";
import { PiggyBank, Plus, Trash2 } from "lucide-react";

const budgetFormSchema = insertBudgetSchema.omit({ userId: true }).extend({
  amountLimit: z.coerce.number().min(1, "Amount must be at least 1"),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

type BudgetFormProps = {
  initialValues?: Partial<BudgetFormValues>;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (values: BudgetFormValues) => void;
};

function BudgetForm({ initialValues, submitLabel, isPending, onSubmit }: BudgetFormProps) {
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      category: initialValues?.category || "",
      amountLimit: Number(initialValues?.amountLimit || 0),
      period: initialValues?.period || "monthly",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <Input placeholder="Food, Transport, Shopping..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amountLimit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount Limit</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="period"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Period</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "monthly"}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {submitLabel}
        </Button>
      </form>
    </Form>
  );
}

export default function Budgets() {
  const { data: budgets, isLoading } = useBudgets();
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null);

  const editingBudget = useMemo(
    () => budgets?.find((item) => item.id === editingBudgetId),
    [budgets, editingBudgetId]
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-4 md:p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold">Budgets</h1>
            <p className="text-muted-foreground mt-1">Set and manage spending limits by category.</p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Budget</DialogTitle>
              </DialogHeader>
              <BudgetForm
                submitLabel={createBudget.isPending ? "Creating..." : "Create Budget"}
                isPending={createBudget.isPending}
                onSubmit={(values) => {
                  createBudget.mutate(values as any, {
                    onSuccess: () => setIsCreateOpen(false),
                  });
                }}
              />
            </DialogContent>
          </Dialog>
        </header>

        {isLoading ? (
          <div className="text-muted-foreground">Loading budgets...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {budgets?.map((budget) => (
              <Card key={budget.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PiggyBank className="w-5 h-5 text-primary" />
                    {budget.category}
                  </CardTitle>
                  <CardDescription>{budget.period || "monthly"} budget</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">${Number(budget.amountLimit).toLocaleString()}</p>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Dialog
                    open={editingBudgetId === budget.id}
                    onOpenChange={(open) => setEditingBudgetId(open ? budget.id : null)}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Budget</DialogTitle>
                      </DialogHeader>
                      <BudgetForm
                        initialValues={{
                          category: editingBudget?.category,
                          amountLimit: Number(editingBudget?.amountLimit || 0),
                          period: editingBudget?.period || "monthly",
                        }}
                        submitLabel={updateBudget.isPending ? "Updating..." : "Update Budget"}
                        isPending={updateBudget.isPending}
                        onSubmit={(values) => {
                          updateBudget.mutate(
                            { id: budget.id, ...values } as any,
                            { onSuccess: () => setEditingBudgetId(null) }
                          );
                        }}
                      />
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => deleteBudget.mutate(budget.id)}
                    aria-label="Delete budget"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}

            {(!budgets || budgets.length === 0) && (
              <div className="col-span-full text-center py-12 bg-muted/20 rounded-xl border border-dashed">
                <PiggyBank className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No budgets created yet.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
