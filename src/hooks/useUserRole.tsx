import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "staff" | null;

interface UserRoleContextType {
  role: AppRole;
  loading: boolean;
  isAdmin: boolean;
  username: string | null;
}

const UserRoleContext = createContext<UserRoleContextType>({ role: null, loading: true, isAdmin: false, username: null });

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AppRole>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoleAndProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, role")
          .eq("id", user.id)
          .maybeSingle();

        setUsername(profile?.username ?? "User");
        
        // Fetch role from user_roles table
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        setRole((roleData?.role as AppRole) ?? (profile?.role as AppRole) ?? "staff");
      } else {
        setUsername(null);
        setRole(null);
      }
      setLoading(false);
    };

    fetchRoleAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRoleAndProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserRoleContext.Provider value={{ role, loading, isAdmin: role === "admin", username }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export const useUserRole = () => useContext(UserRoleContext);
