import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xl">F</div>
            <span className="text-xl font-display font-bold">FinSmart</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-3">
  <Link href="/signup">
    <Button variant="default">Sign Up</Button>
  </Link>
  <Link href="/login">
    <Button variant="outline">Login</Button>
  </Link>
</div>

          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-20 pb-32">
          {/* Background Gradients */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 opacity-30 pointer-events-none">
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary rounded-full blur-[128px]" />
            <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[128px]" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-6 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                  Master Your Money with AI Intelligence
                </h1>
                <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
                  Track expenses, optimize taxes, and grow your wealth with the first personal finance platform powered by real-time AI insights.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/signup">
                    <Button size="lg" className="text-lg px-8 h-14 rounded-full shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all hover:-translate-y-1">
                      Get Started Free <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </div>

            {/* Dashboard Preview */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="mt-20 relative mx-auto max-w-5xl"
            >
              <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-2 shadow-2xl">
                {/* Mock Dashboard UI - replace mock image with pure CSS later if needed, but for now a placeholder structure */}
                <div className="aspect-[16/9] rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center border border-border/30 overflow-hidden">
                   {/* Abstract representation of dashboard */}
                   <div className="w-full h-full relative">
                      {/* Sidebar */}
                      <div className="absolute left-0 top-0 bottom-0 w-64 border-r border-border/20 bg-card/40" />
                      {/* Header */}
                      <div className="absolute left-64 right-0 top-0 h-16 border-b border-border/20 bg-card/40" />
                      {/* Content */}
                      <div className="absolute left-64 right-0 top-16 bottom-0 p-8 grid grid-cols-3 gap-6">
                        <div className="col-span-2 space-y-6">
                          <div className="h-32 rounded-xl bg-primary/10 border border-primary/20" />
                          <div className="h-64 rounded-xl bg-card border border-border/20" />
                        </div>
                        <div className="space-y-6">
                          <div className="h-48 rounded-xl bg-card border border-border/20" />
                          <div className="h-48 rounded-xl bg-card border border-border/20" />
                        </div>
                      </div>
                   </div>
                   <div className="absolute inset-0 flex items-center justify-center">
                     <p className="text-muted-foreground font-medium">Interactive Dashboard Preview</p>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-12">
              <Feature 
                icon={Zap}
                title="AI Categorization"
                description="Our AI automatically categorizes your transactions and identifies tax-deductible expenses in real-time."
              />
              <Feature 
                icon={Shield}
                title="Tax Intelligence"
                description="Never miss a deduction. Get proactive alerts about 80C limits and tax-saving opportunities."
              />
              <Feature 
                icon={CheckCircle2}
                title="Smart Budgeting"
                description="Set dynamic budgets that adapt to your spending habits and keep you on track effortlessly."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-12 bg-card">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 FinSmart. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, description }: any) {
  return (
    <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-background border border-border/50 shadow-sm hover:shadow-md transition-all">
      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
