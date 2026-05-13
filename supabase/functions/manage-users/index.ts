import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .maybeSingle();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // LIST users - join auth.users with profiles
    if (req.method === "GET" && action === "list") {
      const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) throw error;

      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, username, role, created_at");

      const profileMap: Record<string, any> = {};
      profiles?.forEach((p: any) => {
        profileMap[p.id] = p;
      });

      const users = authUsers.users.map((u: any) => ({
        id: u.id,
        email: u.email,
        username: profileMap[u.id]?.username || "Unknown",
        role: profileMap[u.id]?.role || "staff",
        created_at: profileMap[u.id]?.created_at || u.created_at,
      }));

      return new Response(JSON.stringify(users), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE user
    if (req.method === "POST" && action === "create") {
      const { email, password, username, role } = await req.json();

      if (!email || !password || !username) {
        return new Response(JSON.stringify({ error: "Email, password, and username are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (username.length < 3 || /\s/.test(username)) {
        return new Response(JSON.stringify({ error: "Username must be at least 3 characters with no spaces" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (password.length < 8) {
        return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const validRole = ["admin", "staff"].includes(role) ? role : "staff";

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, role: validRole },
      });

      if (createError) {
        const msg = createError.message.toLowerCase();
        if (msg.includes("already") || msg.includes("exists") || msg.includes("duplicate")) {
          return new Response(JSON.stringify({ error: "A user with this email already exists" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw createError;
      }

      // Insert into profiles
      await supabaseAdmin.from("profiles").upsert({
        id: newUser.user.id,
        username,
        role: validRole,
      });

      // Insert into user_roles
      await supabaseAdmin.from("user_roles").upsert({
        user_id: newUser.user.id,
        role: validRole,
      });

      return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE user
    if (req.method === "POST" && action === "update") {
      const { userId, email, username, role } = await req.json();

      if (!userId) {
        return new Response(JSON.stringify({ error: "Missing userId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Block admin from changing own role to staff
      if (userId === callerId && role === "staff") {
        return new Response(JSON.stringify({ error: "You cannot change your own role to Staff" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const validRole = ["admin", "staff"].includes(role) ? role : "staff";

      // Update auth user email if provided
      if (email) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email });
        if (authError) throw authError;
      }

      // Update profiles
      if (username || role) {
        const updates: any = {};
        if (username) updates.username = username;
        if (role) updates.role = validRole;
        await supabaseAdmin.from("profiles").update(updates).eq("id", userId);
      }

      // Update user_roles
      if (role) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: validRole });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE ROLE (legacy endpoint)
    if (req.method === "POST" && action === "update-role") {
      const { userId, role } = await req.json();
      if (!userId || !["admin", "staff"].includes(role)) {
        return new Response(JSON.stringify({ error: "Invalid userId or role" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (userId === callerId && role === "staff") {
        return new Response(JSON.stringify({ error: "You cannot change your own role to Staff" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;

      await supabaseAdmin.from("profiles").update({ role }).eq("id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RESET PASSWORD
    if (req.method === "POST" && action === "reset-password") {
      const { userId, password } = await req.json();
      if (!userId || !password || password.length < 8) {
        return new Response(JSON.stringify({ error: "Valid userId and password (min 8 chars) required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE user
    if (req.method === "POST" && action === "delete") {
      const { userId } = await req.json();
      if (!userId) {
        return new Response(JSON.stringify({ error: "Missing userId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (userId === callerId) {
        return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
