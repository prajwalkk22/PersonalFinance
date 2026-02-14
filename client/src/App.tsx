import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Landing from "@/pages/Landing";
import Transactions from "@/pages/Transactions";
import Goals from "@/pages/Goals";
import Tax from "@/pages/Tax";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/">
        {user ? <Redirect to="/dashboard" /> : <Landing />}
      </Route>
      
      <Route path="/dashboard">
        {() => <PrivateRoute component={Dashboard} />}
      </Route>
      
      <Route path="/transactions">
        {() => <PrivateRoute component={Transactions} />}
      </Route>
      
      <Route path="/goals">
        {() => <PrivateRoute component={Goals} />}
      </Route>
      
      <Route path="/tax">
        {() => <PrivateRoute component={Tax} />}
      </Route>

      {/* Placeholders for routes that will be built later or reuse components */}
      <Route path="/budgets">
        {() => <PrivateRoute component={Dashboard} />} {/* Redirect to dashboard for MVP */}
      </Route>
      
      <Route path="/advisor">
        {() => <PrivateRoute component={Tax} />} {/* Redirect to tax for MVP */}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
