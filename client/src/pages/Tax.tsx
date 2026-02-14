import { Sidebar } from "@/components/Sidebar";
import { useTaxAnalytics } from "@/hooks/use-analytics";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Calculator } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Tax() {
  const { data, isLoading } = useTaxAnalytics();

  if (isLoading) return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-8 space-y-8">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
        </div>
      </main>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-display font-bold">Tax Intelligence</h1>
          <p className="text-muted-foreground mt-1">Real-time tax liability estimation and optimization.</p>
        </header>

        {/* Top Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-card to-muted border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Liability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">${data?.estimatedTax.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Based on current FY income</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Deductible Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">${data?.deductibleExpenses.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Detected via AI categorization</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Potential Savings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">${data?.potentialSavings.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">If all limits are utilized</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Deduction Limit Utilization</CardTitle>
              <CardDescription>Section 80C, 80D, etc.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {data?.taxBreakdown.map((item: any, i: number) => {
                // Mock limit for demo purposes, in real app this would come from backend logic
                const limit = 150000; 
                const percentage = Math.min((item.amount / limit) * 100, 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">{item.category}</span>
                      <span className="text-muted-foreground">${item.amount.toLocaleString()} / ${limit.toLocaleString()}</span>
                    </div>
                    <Progress value={percentage} className={`h-2 ${percentage >= 100 ? 'bg-emerald-200' : ''}`} />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Alert variant="default" className="border-emerald-200 bg-emerald-50">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="text-emerald-800">Optimization Opportunity</AlertTitle>
              <AlertDescription className="text-emerald-700">
                You have room to invest $12,000 more in 80C instruments to maximize your tax savings this year.
              </AlertDescription>
            </Alert>

            <Alert>
              <Calculator className="h-4 w-4" />
              <AlertTitle>Tax Regime Comparison</AlertTitle>
              <AlertDescription>
                Based on your deductions, the <strong>Old Regime</strong> currently saves you more tax ($1,200 difference).
              </AlertDescription>
            </Alert>

             <Card className="bg-slate-900 text-white border-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  AI Insight
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300">
                  "Your recent 'Medical Insurance' payment of $500 was automatically flagged as a Section 80D deduction. Great job keeping records!"
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
