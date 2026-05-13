import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Save, Users, Package, Settings as SettingsIcon, Plus, Pencil, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useAppSettings } from "@/hooks/useAppSettings";
import { formatDate } from "@/lib/formatters";

interface ProfileUser {
  id: string;
  email: string;
  username: string;
  role: string;
  created_at: string;
}

interface UserFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
}

const emptyForm: UserFormData = { username: "", email: "", password: "", confirmPassword: "", role: "staff" };

const Settings = () => {
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Add/Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ProfileUser | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [savingUser, setSavingUser] = useState(false);

  const { appName, currencySymbol, defaultStockThreshold, updateSettings } = useAppSettings();
  const [localAppName, setLocalAppName] = useState(appName);
  const [localCurrency, setLocalCurrency] = useState(currencySymbol);
  const [localThreshold, setLocalThreshold] = useState(String(defaultStockThreshold));
  const [savingInventory, setSavingInventory] = useState(false);
  const [savingApp, setSavingApp] = useState(false);

  // Password reset state
  const [passwordUserId, setPasswordUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setLocalAppName(appName);
    setLocalCurrency(currencySymbol);
    setLocalThreshold(String(defaultStockThreshold));
  }, [appName, currencySymbol, defaultStockThreshold]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
    fetchUsers();
  }, []);

  const callEdgeFunction = async (action: string, method: string, body?: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=${action}`;
    const opts: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const response = await fetch(url, opts);
    const data = await response.json();
    return { ok: response.ok, data, status: response.status };
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { ok, data } = await callEdgeFunction("list", "GET");
      if (ok) {
        setUsers(data);
      } else {
        toast.error(data.error || "Failed to fetch users");
      }
    } catch {
      toast.error("Failed to fetch users");
    }
    setLoadingUsers(false);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (user: ProfileUser) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      email: user.email,
      password: "",
      confirmPassword: "",
      role: user.role,
    });
    setModalOpen(true);
  };

  const validateForm = (): string | null => {
    if (!form.username || form.username.length < 3) return "Username must be at least 3 characters";
    if (/\s/.test(form.username)) return "Username must not contain spaces";
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Please enter a valid email";
    if (!editingUser) {
      if (!form.password || form.password.length < 8) return "Password must be at least 8 characters";
      if (form.password !== form.confirmPassword) return "Passwords do not match";
    }
    // Block admin from changing own role to staff
    if (editingUser && editingUser.id === currentUserId && form.role === "staff") {
      return "You cannot change your own role to Staff";
    }
    return null;
  };

  const handleSaveUser = async () => {
    const error = validateForm();
    if (error) { toast.error(error); return; }

    setSavingUser(true);
    try {
      if (editingUser) {
        const { ok, data } = await callEdgeFunction("update", "POST", {
          userId: editingUser.id,
          email: form.email,
          username: form.username,
          role: form.role,
        });
        if (ok) {
          toast.success("User updated successfully");
          setModalOpen(false);
          fetchUsers();
        } else {
          toast.error(data.error || "Failed to update user");
        }
      } else {
        const { ok, data, status } = await callEdgeFunction("create", "POST", {
          email: form.email,
          password: form.password,
          username: form.username,
          role: form.role,
        });
        if (ok) {
          toast.success("User created successfully");
          setModalOpen(false);
          fetchUsers();
        } else {
          if (status === 409) {
            toast.error("A user with this email already exists");
          } else {
            toast.error(data.error || "Failed to create user");
          }
        }
      }
    } catch {
      toast.error("An unexpected error occurred");
    }
    setSavingUser(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    if (deleteUserId === currentUserId) {
      toast.error("You cannot delete your own account");
      setDeleteUserId(null);
      return;
    }
    try {
      const { ok, data } = await callEdgeFunction("delete", "POST", { userId: deleteUserId });
      if (ok) {
        toast.success("User deleted successfully");
        setUsers((prev) => prev.filter((u) => u.id !== deleteUserId));
      } else {
        toast.error(data.error || "Failed to delete user");
      }
    } catch {
      toast.error("Failed to delete user");
    }
    setDeleteUserId(null);
  };

  const handleSaveInventory = async () => {
    const val = Number(localThreshold);
    if (isNaN(val) || val < 0) {
      toast.error("Threshold must be a non-negative number");
      return;
    }
    setSavingInventory(true);
    const ok = await updateSettings({ defaultStockThreshold: val });
    setSavingInventory(false);
    if (ok) toast.success("Inventory settings saved");
    else toast.error("Failed to save settings");
  };

  const handleSaveApp = async () => {
    if (!localAppName.trim()) {
      toast.error("App name cannot be empty");
      return;
    }
    setSavingApp(true);
    const ok = await updateSettings({ appName: localAppName.trim(), currencySymbol: localCurrency });
    setSavingApp(false);
    if (ok) toast.success("App settings saved");
    else toast.error("Failed to save settings");
  };

  const handleResetPassword = async () => {
    if (!passwordUserId) { toast.error("Please select a user"); return; }
    if (!newPassword || newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmNewPassword) { toast.error("Passwords do not match"); return; }
    setSavingPassword(true);
    try {
      const { ok, data } = await callEdgeFunction("reset-password", "POST", {
        userId: passwordUserId,
        password: newPassword,
      });
      if (ok) {
        toast.success("Password updated successfully");
        setNewPassword("");
        setConfirmNewPassword("");
        setPasswordUserId("");
      } else {
        toast.error(data.error || "Failed to reset password");
      }
    } catch {
      toast.error("An unexpected error occurred");
    }
    setSavingPassword(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground">System configuration and preferences.</p>
      </div>

      {/* Section 1 — User Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">User Management</CardTitle>
            </div>
            <Button size="sm" onClick={openAddModal} className="gap-2">
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          </div>
          <CardDescription>Manage registered users and their roles.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No users found.</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Date Created</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role === "admin" ? "Admin" : "Staff"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(user.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {user.id !== currentUserId ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteUserId(user.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Badge variant="outline" className="text-xs ml-1">You</Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section — Reset User Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Reset User Password</CardTitle>
          </div>
          <CardDescription>Change the password for any user account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label>Select User</Label>
              <Select value={passwordUserId} onValueChange={setPasswordUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.username} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="min 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="re-enter password"
              />
            </div>
            <Button onClick={handleResetPassword} disabled={savingPassword} className="gap-2">
              <Save className="h-4 w-4" />
              {savingPassword ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 2 — Inventory Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Inventory Settings</CardTitle>
          </div>
          <CardDescription>Configure default inventory thresholds.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 max-w-md">
            <div className="space-y-2 flex-1 w-full">
              <Label htmlFor="threshold">Default Stock Alert Threshold</Label>
              <Input
                id="threshold"
                type="number"
                min="0"
                value={localThreshold}
                onChange={(e) => setLocalThreshold(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This value pre-fills the stock threshold when adding new products.
              </p>
            </div>
            <Button onClick={handleSaveInventory} disabled={savingInventory} className="gap-2">
              <Save className="h-4 w-4" />
              {savingInventory ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 3 — App Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">App Settings</CardTitle>
          </div>
          <CardDescription>Configure application display preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="appName">App Name</Label>
              <Input
                id="appName"
                value={localAppName}
                onChange={(e) => setLocalAppName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency Symbol</Label>
              <Select value={localCurrency} onValueChange={setLocalCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETB">ETB — Ethiopian Birr</SelectItem>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveApp} disabled={savingApp} className="gap-2">
              <Save className="h-4 w-4" />
              {savingApp ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit User Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="min 3 chars, no spaces"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            {!editingUser && (
              <>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="min 8 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="re-enter password"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(val) => setForm({ ...form, role: val })}
                disabled={editingUser?.id === currentUserId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
              {editingUser?.id === currentUserId && (
                <p className="text-xs text-muted-foreground">You cannot change your own role.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={savingUser}>
              {savingUser ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone. The user will lose access to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
