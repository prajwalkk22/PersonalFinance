import { Sidebar } from "@/components/Sidebar";
import { useGoals, useCreateGoal, useDeleteGoal, useUpdateGoal } from "@/hooks/use-goals";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Plus, Target, Trash2, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertGoalSchema } from "@shared/schema";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Create Goal Form Component
const createGoalSchema = insertGoalSchema.omit({ userId: true }).extend({
  targetAmount: z.coerce.number().min(1),
  deadline: z.coerce.date().optional(),
});

function CreateGoalForm({ onSuccess }: { onSuccess: () => void }) {
  const createMutation = useCreateGoal();
  const form = useForm({
    resolver: zodResolver(createGoalSchema),
    defaultValues: { name: "", targetAmount: 0 },
  });

  function onSubmit(values: any) {
    createMutation.mutate(values, { onSuccess });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField name="name" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>Goal Name</FormLabel><FormControl><Input placeholder="New Car" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField name="targetAmount" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>Target Amount</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={createMutation.isPending}>Create Goal</Button>
      </form>
    </Form>
  );
}

export default function Goals() {
  const { data: goals, isLoading } = useGoals();
  const deleteMutation = useDeleteGoal();
  const updateMutation = useUpdateGoal();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleAddSavings = (id: number) => {
    const amount = prompt("Enter amount to add:");
    if (amount && !isNaN(parseFloat(amount))) {
      updateMutation.mutate({ id, addToCurrentAmount: parseFloat(amount) }, {
        onSuccess: () => toast({ title: "Savings added!" })
      });
    }
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-4 md:p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold">Savings Goals</h1>
            <p className="text-muted-foreground mt-1">Track your progress towards financial dreams.</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Goal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Savings Goal</DialogTitle></DialogHeader>
              <CreateGoalForm onSuccess={() => setIsCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals?.map((goal) => {
            const progress = (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100;
            return (
              <Card key={goal.id} className="relative overflow-hidden group hover:shadow-lg transition-all">
                <div className={`absolute top-0 left-0 w-1 h-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-primary'}`} />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl flex items-center gap-2">
                      {progress >= 100 ? <Trophy className="w-5 h-5 text-yellow-500" /> : <Target className="w-5 h-5 text-primary" />}
                      {goal.name}
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => deleteMutation.mutate(goal.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <CardDescription>Target: ${Number(goal.targetAmount).toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm mb-2 font-medium">
                    <span>${Number(goal.currentAmount).toLocaleString()}</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full" onClick={() => handleAddSavings(goal.id)}>
                    Add Savings
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
          {(!goals || goals.length === 0) && (
            <div className="col-span-full text-center py-12 bg-muted/20 rounded-xl border border-dashed">
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No goals yet. Start saving today!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
