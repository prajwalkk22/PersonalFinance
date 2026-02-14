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
import Login from "@/pages/Login";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Loader2 className="animate-spin" />;

  return (
    <Switch>
      <Route path="/">
        {user ? <Redirect to="/dashboard" /> : <Landing />}
      </Route>

      <Route path="/login">
        <Login />
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

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
