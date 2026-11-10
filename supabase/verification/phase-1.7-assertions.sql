-- READ-ONLY ASSERTIONS / NOT EXECUTED. Approved staging first, no application rows.
-- This checks database metadata, not HTTP routing or function body safety.
begin read only;
do $assert_security$
declare
  role_name text;
  signature text;
  target text;
  privilege_name text;
begin
  foreach signature in array array[
    'public.create_admin_user(text,text,boolean,integer)',
    'public.update_admin_user(uuid,boolean,integer,text)',
    'public.remove_audit_log_entry(bigint,text,text)'
  ] loop
    foreach role_name in array array['anon','authenticated'] loop
      if has_function_privilege(role_name, signature, 'EXECUTE') then
        raise exception 'Unexpected RPC execution for % on %', role_name, signature;
      end if;
    end loop;
    if not has_function_privilege('service_role', signature, 'EXECUTE') then
      raise exception 'Required server RPC execution missing';
    end if;
  end loop;
  foreach target in array array[
    'admin_users','groups','module_access','admin_contact_reads','admin_inquire_reads',
    'admin_loan_preapp_reads','audit_logs','client','contact','inquire','loan_preapp'
  ] loop
    foreach role_name in array array['anon','authenticated'] loop
      foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE'] loop
        if has_table_privilege(role_name, format('public.%I', target), privilege_name) then
          raise exception 'Unexpected private-table privilege: % % %', role_name, target, privilege_name;
        end if;
        if privilege_name in ('SELECT','INSERT','UPDATE') and has_any_column_privilege(role_name, format('public.%I', target), privilege_name) then
          raise exception 'Unexpected private-column privilege';
        end if;
      end loop;
    end loop;
  end loop;
  foreach target in array array[
    'navbar_projects','our story','amenities','banks','child_marker_table',
    'extended_description','marker_type_table','modules','news_updates','parent_marker',
    'project_banks','project_table','project_tag','promotions','tags','unit_layout','virtual_tours'
  ] loop
    foreach role_name in array array['anon','authenticated'] loop
      if not has_any_column_privilege(role_name, format('public.%I', target), 'SELECT') then
        raise exception 'Required public SELECT missing on %', target;
      end if;
      foreach privilege_name in array array['INSERT','UPDATE','DELETE'] loop
        if has_table_privilege(role_name, format('public.%I', target), privilege_name) then
          raise exception 'Unexpected content mutation privilege';
        end if;
        if privilege_name in ('INSERT','UPDATE') and has_any_column_privilege(role_name, format('public.%I', target), privilege_name) then
          raise exception 'Unexpected content column mutation privilege';
        end if;
      end loop;
    end loop;
  end loop;
end
$assert_security$;
rollback;
