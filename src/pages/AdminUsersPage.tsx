import { useState, useEffect } from 'react';
import { Plus, Search, Shield, Users, Building2, Edit2, Trash2, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../hooks/usePermissions';
import Modal from '../components/ui/Modal';
import StatCard from '../components/ui/StatCard';
import type { Profile, Branch } from '../types/database';
import type { Role, Permission, UserRole, UserBranchAccess } from '../types/permissions';

interface UserWithDetails extends Profile {
  user_roles: (UserRole & { roles: Role })[];
  user_branch_access: (UserBranchAccess & { branches: Branch })[];
}

export default function AdminUsersPage() {
  const { isAdmin, hasPermission } = usePermissions();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'permissions'>('users');
  
  // User modal state
  const [userModal, setUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [userBranches, setUserBranches] = useState<{ branch_id: string; access_level: string }[]>([]);
  
  // Create user modal state
  const [createUserModal, setCreateUserModal] = useState(false);
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'operator' as Profile['role'],
  });
  const [deleteModal, setDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithDetails | null>(null);
  
  // Role modal state
  const [roleModal, setRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [roleForm, setRoleForm] = useState({ code: '', name: '', description: '' });
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [usersRes, rolesRes, permsRes, branchesRes] = await Promise.all([
      supabase.from('profiles').select(`
        *,
        user_roles(*, roles(*)),
        user_branch_access(*, branches(*))
      `).order('full_name'),
      supabase.from('roles').select('*').order('name'),
      supabase.from('permissions').select('*').order('module, code'),
      supabase.from('branches').select('*').eq('is_active', true).order('name'),
    ]);
    
    setUsers(usersRes.data || []);
    setRoles(rolesRes.data || []);
    setPermissions(permsRes.data || []);
    setBranches(branchesRes.data || []);
    setLoading(false);
  }

  function openUserModal(user: UserWithDetails) {
    setSelectedUser(user);
    setUserRoles(user.user_roles?.map(ur => ur.role_id) || []);
    setUserBranches(user.user_branch_access?.map(uba => ({ 
      branch_id: uba.branch_id, 
      access_level: uba.access_level 
    })) || []);
    setUserModal(true);
  }

  async function saveUserRoles() {
    if (!selectedUser) return;
    setSaving(true);
    
    // Delete existing roles and add new ones
    await supabase.from('user_roles').delete().eq('user_id', selectedUser.id);
    if (userRoles.length > 0) {
      await supabase.from('user_roles').insert(
        userRoles.map(roleId => ({ user_id: selectedUser.id, role_id: roleId }))
      );
    }
    
    // Delete existing branch access and add new ones
    await supabase.from('user_branch_access').delete().eq('user_id', selectedUser.id);
    if (userBranches.length > 0) {
      await supabase.from('user_branch_access').insert(
        userBranches.map(ub => ({ 
          user_id: selectedUser.id, 
          branch_id: ub.branch_id, 
          access_level: ub.access_level 
        }))
      );
    }
    
    setSaving(false);
    setUserModal(false);
    fetchData();
  }

  function openCreateUserModal() {
    setUserForm({
      email: '',
      password: '',
      full_name: '',
      phone: '',
      role: 'operator',
    });
    setUserRoles([]);
    setUserBranches([]);
    setCreateUserModal(true);
  }

  async function createUser() {
    if (!userForm.email || !userForm.password || !userForm.full_name) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userForm.email,
        password: userForm.password,
        options: {
          data: {
            full_name: userForm.full_name,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const userId = authData.user.id;
        // Update profile with additional info
        await supabase
          .from('profiles')
          .update({
            full_name: userForm.full_name,
            phone: userForm.phone,
            role: userForm.role,
          })
          .eq('id', userId);

        // Assign roles
        if (userRoles.length > 0) {
          await supabase.from('user_roles').insert(
            userRoles.map(roleId => ({ user_id: userId, role_id: roleId }))
          );
        }

        // Assign branch access
        if (userBranches.length > 0) {
          await supabase.from('user_branch_access').insert(
            userBranches.map(ub => ({
              user_id: userId,
              branch_id: ub.branch_id,
              access_level: ub.access_level,
            }))
          );
        }

        alert('User created successfully!');
        setCreateUserModal(false);
        fetchData();
      }
    } catch (error: any) {
      alert(`Error creating user: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  
  function openDeleteModal(user: UserWithDetails) {
    setUserToDelete(user);
    setDeleteModal(true);
  }

  async function deleteUser() {
    if (!userToDelete) return;
    setSaving(true);
    try {
      // Delete user roles and branch access first
      await supabase.from('user_roles').delete().eq('user_id', userToDelete.id);
      await supabase.from('user_branch_access').delete().eq('user_id', userToDelete.id);
      
      // Note: We can't delete auth users via client SDK, only profiles
      // Admin should use Supabase dashboard to fully delete auth users
      await supabase.from('profiles').delete().eq('id', userToDelete.id);

      alert('User profile deleted successfully!');
      setDeleteModal(false);
      setUserToDelete(null);
      fetchData();
    } catch (error: any) {
      alert(`Error deleting user: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  function openRoleModal(role?: Role) {
    if (role) {
      setSelectedRole(role);
      setRoleForm({ code: role.code, name: role.name, description: role.description || '' });
      // Load role permissions
      supabase.from('role_permissions')
        .select('permission_id')
        .eq('role_id', role.id)
        .then(({ data }) => {
          setRolePermissions(data?.map(rp => rp.permission_id) || []);
        });
    } else {
      setSelectedRole(null);
      setRoleForm({ code: '', name: '', description: '' });
      setRolePermissions([]);
    }
    setRoleModal(true);
  }

  async function saveRole() {
    setSaving(true);
    
    let roleId = selectedRole?.id;
    
    if (selectedRole) {
      // Update existing role
      await supabase.from('roles')
        .update({ name: roleForm.name, description: roleForm.description })
        .eq('id', selectedRole.id);
    } else {
      // Create new role
      const { data } = await supabase.from('roles')
        .insert({ code: roleForm.code, name: roleForm.name, description: roleForm.description })
        .select()
        .single();
      roleId = data?.id;
    }
    
    if (roleId) {
      // Update permissions
      await supabase.from('role_permissions').delete().eq('role_id', roleId);
      if (rolePermissions.length > 0) {
        await supabase.from('role_permissions').insert(
          rolePermissions.map(permId => ({ role_id: roleId, permission_id: permId }))
        );
      }
    }
    
    setSaving(false);
    setRoleModal(false);
    fetchData();
  }

  async function deleteRole(roleId: string) {
    if (!confirm('Are you sure you want to delete this role?')) return;
    await supabase.from('roles').delete().eq('id', roleId);
    fetchData();
  }

  function toggleUserRole(roleId: string) {
    setUserRoles(prev => 
      prev.includes(roleId) 
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  }

  function toggleRolePermission(permId: string) {
    setRolePermissions(prev => 
      prev.includes(permId) 
        ? prev.filter(id => id !== permId)
        : [...prev, permId]
    );
  }

  function addBranchAccess() {
    const availableBranches = branches.filter(b => !userBranches.some(ub => ub.branch_id === b.id));
    if (availableBranches.length > 0) {
      setUserBranches([...userBranches, { branch_id: availableBranches[0].id, access_level: 'read' }]);
    }
  }

  function removeBranchAccess(branchId: string) {
    setUserBranches(userBranches.filter(ub => ub.branch_id !== branchId));
  }

  function updateBranchAccess(branchId: string, field: 'branch_id' | 'access_level', value: string) {
    setUserBranches(userBranches.map(ub => 
      ub.branch_id === branchId ? { ...ub, [field]: value } : ub
    ));
  }

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const permissionsByModule = permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Stats
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.user_roles?.some(ur => ur.roles?.code === 'admin')).length;
  const activeRoles = roles.filter(r => r.is_active).length;

  if (!isAdmin() && !hasPermission('admin.users')) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-red-800">Access Denied</h2>
          <p className="text-sm text-red-600 mt-1">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User & Access Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage users, roles, and permissions</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={totalUsers} icon={Users} color="teal" />
        <StatCard title="Administrators" value={adminCount} icon={Shield} color="red" />
        <StatCard title="Active Roles" value={activeRoles} icon={Key} color="amber" />
        <StatCard title="Branches" value={branches.length} icon={Building2} color="slate" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { key: 'users', label: 'Users', icon: Users },
          { key: 'roles', label: 'Roles & Permissions', icon: Shield },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
            <button
              onClick={openCreateUserModal}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create User
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['User', 'Email', 'Roles', 'Branch Access', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-teal-700">
                            {user.full_name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{user.full_name || 'No name'}</p>
                          <p className="text-xs text-slate-500">{user.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.user_roles?.length > 0 ? (
                          user.user_roles.map(ur => (
                            <span key={ur.id} className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs rounded-full">
                              {ur.roles?.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">No roles assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.user_branch_access?.length > 0 ? (
                          user.user_branch_access.map(uba => (
                            <span key={uba.id} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                              {uba.branches?.name} ({uba.access_level})
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">All branches</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openUserModal(user)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit user access"
                        >
                          <Edit2 className="w-4 h-4 text-slate-500" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(user)}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openRoleModal()}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Role
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(role => (
              <div key={role.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">{role.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{role.code}</p>
                  </div>
                  {!role.is_system && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => openRoleModal(role)}
                        className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-slate-500" />
                      </button>
                      <button
                        onClick={() => deleteRole(role.id)}
                        className="p-1.5 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-600 mb-3">{role.description || 'No description'}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className={`px-2 py-1 rounded ${role.is_system ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {role.is_system ? 'System Role' : 'Custom Role'}
                  </span>
                  <span className={`px-2 py-1 rounded ${role.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {role.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Edit Modal */}
      <Modal open={userModal} onClose={() => setUserModal(false)} title={`Edit Access: ${selectedUser?.full_name}`} size="lg">
        <div className="space-y-6">
          {/* Roles Section */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Assign Roles
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {roles.filter(r => r.is_active).map(role => (
                <label
                  key={role.id}
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    userRoles.includes(role.id)
                      ? 'bg-teal-50 border-teal-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={userRoles.includes(role.id)}
                    onChange={() => toggleUserRole(role.id)}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{role.name}</p>
                    <p className="text-xs text-slate-500">{role.code}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Branch Access Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Branch Access
              </h3>
              <button
                onClick={addBranchAccess}
                className="text-xs text-teal-600 hover:text-teal-700 font-medium"
              >
                + Add Branch
              </button>
            </div>
            {userBranches.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No branch restrictions (access to all branches)</p>
            ) : (
              <div className="space-y-2">
                {userBranches.map((ub, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={ub.branch_id}
                      onChange={(e) => updateBranchAccess(ub.branch_id, 'branch_id', e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <select
                      value={ub.access_level}
                      onChange={(e) => updateBranchAccess(ub.branch_id, 'access_level', e.target.value)}
                      className="w-32 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      <option value="read">Read</option>
                      <option value="write">Write</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => removeBranchAccess(ub.branch_id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => setUserModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveUserRoles}
              disabled={saving}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Role Edit Modal */}
      <Modal open={roleModal} onClose={() => setRoleModal(false)} title={selectedRole ? `Edit Role: ${selectedRole.name}` : 'Create New Role'} size="xl">
        <div className="space-y-6">
          {/* Role Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role Code</label>
              <input
                type="text"
                value={roleForm.code}
                onChange={(e) => setRoleForm({ ...roleForm, code: e.target.value })}
                disabled={!!selectedRole}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50"
                placeholder="e.g., quality_manager"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role Name</label>
              <input
                type="text"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="e.g., Quality Manager"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="Brief description of this role"
              />
            </div>
          </div>

          {/* Permissions */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Permissions</h3>
            <div className="max-h-96 overflow-y-auto space-y-4 border border-slate-200 rounded-lg p-4">
              {Object.entries(permissionsByModule).map(([module, perms]) => (
                <div key={module}>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    {module.replace('_', ' ')}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {perms.map(perm => (
                      <label
                        key={perm.id}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors text-sm ${
                          rolePermissions.includes(perm.id)
                            ? 'bg-teal-50 border-teal-300'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={rolePermissions.includes(perm.id)}
                          onChange={() => toggleRolePermission(perm.id)}
                          className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                        />
                        <span className="text-slate-700">{perm.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => setRoleModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveRole}
              disabled={saving || !roleForm.code || !roleForm.name}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : selectedRole ? 'Update Role' : 'Create Role'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create User Modal */}
      <Modal open={createUserModal} onClose={() => setCreateUserModal(false)} title="Create New User" size="lg">
        <div className="space-y-6">
          {/* User Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={userForm.full_name}
                onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
              <input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="+1234567890"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Default Role</label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Profile['role'] })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="operator">Operator</option>
                <option value="supervisor">Supervisor</option>
                <option value="production_manager">Production Manager</option>
                <option value="warehouse_manager">Warehouse Manager</option>
                <option value="finance">Finance</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>

          {/* Roles Section */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Assign Additional Roles
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {roles.filter(r => r.is_active).map(role => (
                <label
                  key={role.id}
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    userRoles.includes(role.id)
                      ? 'bg-teal-50 border-teal-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={userRoles.includes(role.id)}
                    onChange={() => toggleUserRole(role.id)}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{role.name}</p>
                    <p className="text-xs text-slate-500">{role.code}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Branch Access Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Branch Access
              </h3>
              <button
                onClick={addBranchAccess}
                className="text-xs text-teal-600 hover:text-teal-700 font-medium"
              >
                + Add Branch
              </button>
            </div>
            {userBranches.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No branch restrictions (access to all branches)</p>
            ) : (
              <div className="space-y-2">
                {userBranches.map((ub, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={ub.branch_id}
                      onChange={(e) => updateBranchAccess(ub.branch_id, 'branch_id', e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <select
                      value={ub.access_level}
                      onChange={(e) => updateBranchAccess(ub.branch_id, 'access_level', e.target.value)}
                      className="w-32 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      <option value="read">Read</option>
                      <option value="write">Write</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => removeBranchAccess(ub.branch_id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => setCreateUserModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createUser}
              disabled={saving || !userForm.email || !userForm.password || !userForm.full_name}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete User Modal */}
      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Delete User" size="sm">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              Are you sure you want to delete <strong>{userToDelete?.full_name}</strong>?
            </p>
            <p className="text-xs text-red-600 mt-2">
              This will remove the user profile and all associated roles and permissions. 
              The authentication account will remain in Supabase and needs to be deleted manually from the dashboard.
            </p>
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={deleteUser}
              disabled={saving}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Deleting...' : 'Delete User'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
