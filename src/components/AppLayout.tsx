import { useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/products": "Products",
  "/categories": "Categories",
  "/sales": "Sales",
  "/customers": "Customers",
  "/feedback": "Feedback",
  "/recipes": "Recipes",
  "/reports": "Reports",
  "/settings": "Settings",
};

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { appName } = useAppSettings();
  const { username, role, loading: profileLoading } = useUserRole();

  const pageTitle = pageTitles[location.pathname] || "Dashboard";

  useEffect(() => {
    if (appName) document.title = appName;
  }, [appName]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logged out successfully" });
    navigate("/login", { replace: true });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0 sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="flex-col gap-0.5 items-center justify-center h-10 w-12 md:h-auto md:w-auto md:flex-row md:gap-0 text-muted-foreground md:bg-transparent md:text-muted-foreground bg-primary text-primary-foreground rounded-md md:p-0 md:rounded-none">
                <span className="md:hidden text-[10px] font-medium leading-none">Menu</span>
              </SidebarTrigger>
              <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-4">
              {profileLoading ? (
                <span className="text-sm text-muted-foreground hidden sm:inline">Loading...</span>
              ) : (
                <div className="flex items-center gap-2 hidden sm:flex">
                  <span className="text-sm text-foreground font-medium">
                    Hey, {username || "User"}!
                  </span>
                  <Badge variant={role === "admin" ? "default" : "secondary"} className="text-xs">
                    {role === "admin" ? "Admin" : "Staff"}
                  </Badge>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
