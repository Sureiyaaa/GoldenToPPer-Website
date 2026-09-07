// app/actions/auth.ts
'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export async function loginAction(formData: FormData) {
  console.log("[AUTH] 1. Login Action Triggered!");

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log("[AUTH] ERROR: Missing Environment Variables");
      return { error: "CRITICAL: Missing SUPABASE_SERVICE_ROLE_KEY in .env.local file." };
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log("[AUTH] 2. Supabase Admin Client Initialized");

    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) {
      return { error: "Username and password are required." };
    }

    const cleanUsername = username.trim().toLowerCase();
    console.log(`[AUTH] 3. Searching DB for username: ${cleanUsername}`);

    // 1. DATABASE CHECK
    const { data: user, error } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('username', cleanUsername)
      .single();

    if (error) {
      console.log("[AUTH] ERROR: DB Search Failed:", error.message);
      return { error: "Invalid username." };
    }
    if (!user) {
      console.log("[AUTH] ERROR: User not found in DB.");
      return { error: "Invalid username." };
    }
    
    console.log("[AUTH] 4. User found! Checking status...");

    if (user.is_active === false) {
      console.log("[AUTH] ERROR: Account is disabled.");
      return { error: "Account disabled. Contact an admin." };
    }

    console.log("[AUTH] 5. Checking password match via Bcrypt...");
    
    // 2. SECURE PASSWORD MATCH (Comparing plain text to hash)
    // This replaces the old: user.password_hash !== password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      console.log("[AUTH] ERROR: Passwords do not match!");
      return { error: "Invalid password." };
    }

    console.log("[AUTH] 6. Password matched! Setting cookie...");

    // 3. Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set('custom_admin_session', String(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    console.log("[AUTH] 7. Cookie set successfully. Login complete!");
    return { success: true };

  } catch (err: any) {
    console.error("[AUTH] FATAL SERVER CRASH:", err);
    return { error: err.message || "An unexpected error occurred on the server." };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('custom_admin_session');
}

export async function getCustomSession() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('custom_admin_session')?.value;
  if (!userId) return null;
  return userId; 
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('custom_admin_session')?.value;
  if (!userId) return null;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: user } = await supabaseAdmin
    .from('admin_users')
    .select('id, username, is_super_admin')
    .eq('id', userId)
    .single();

  return user;
}

export async function getRBACProfile() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('custom_admin_session')?.value;
  if (!userId) return null;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: user } = await supabaseAdmin
    .from('admin_users')
    .select('id, username, is_super_admin, group_id, is_active')
    .eq('id', userId)
    .single();

  if (!user || user.is_active === false) return null;

  if (user.is_super_admin) {
    return { role: 'admin', permissions: 'SUPER_ADMIN' };
  }

  if (!user.group_id) return null;

  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('is_active')
    .eq('id', user.group_id)
    .single();

  if (!group || group.is_active === false) return null;

  const { data: accessData } = await supabaseAdmin
    .from('module_access')
    .select(`can_view, can_create, can_edit, can_delete, modules ( module_code )`)
    .eq('group_id', user.group_id);

  const permsMap: Record<string, any> = {};
  if (accessData) {
    accessData.forEach((row: any) => {
      const mCode = Array.isArray(row.modules) ? row.modules[0]?.module_code : row.modules?.module_code;
      if (mCode) {
        permsMap[mCode] = {
          can_view: row.can_view,
          can_create: row.can_create,
          can_edit: row.can_edit,
          can_delete: row.can_delete
        };
      }
    });
  }

  return { role: 'editor', permissions: permsMap };
}