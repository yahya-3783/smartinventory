import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Lock, Mail } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message,
      });
    } else {
      window.scrollTo(0, 0);
      navigate("/dashboard", { replace: true });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-primary">
      {/* Left decorative panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-sidebar-accent opacity-90" />
        <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full bg-sidebar-primary/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-10 w-96 h-96 rounded-full bg-sidebar-primary/10 blur-3xl" />
        <div className="relative z-10 text-center px-12">
          <h1 className="text-5xl font-extrabold tracking-tight text-primary-foreground leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
            Smart Inventory
          </h1>
          <h1 className="text-5xl font-extrabold tracking-tight text-sidebar-primary leading-tight mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>
            Addis
          </h1>
          <p className="mt-6 text-primary-foreground/70 text-lg max-w-md mx-auto">
            Your all-in-one supermarket management platform for inventory, sales, customers and insights.
          </p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background rounded-l-none lg:rounded-l-3xl relative">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile title */}
          <div className="text-center lg:hidden">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
              Smart Inventory
            </h1>
            <h1 className="text-3xl font-extrabold tracking-tight text-sidebar-primary leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
              Addis
            </h1>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="text-muted-foreground text-sm">Sign in to your account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground text-sm font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground pt-4">
            Smart Inventory Addis &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
