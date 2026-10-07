export type CustomerInboxItemType = 'inquiry' | 'loan_application' | 'customer_support';
export type CustomerInboxReadFilter = 'all' | 'unread' | 'read';
export type CustomerRecordId = number | string;

type CustomerInboxBase = {
  id: CustomerRecordId;
  title: string;
  name: string;
  client_email: string | null;
  client_phone: string | null;
  created_at: string | null;
  is_read: boolean;
  can_mark_read: boolean;
};

export type CustomerInboxItem = CustomerInboxBase & (
  | { type: 'inquiry'; project_name: string }
  | { type: 'customer_support'; message: string }
  | {
      type: 'loan_application'; project_name: string; bank_name: string;
      tower: string | null; unit_no: number | null; floor_no: number | null;
      co_buyer_name: string | null; is_agreed: boolean | null;
    }
);

type Relation<T> = T | T[] | null;
type CustomerClient = {
  first_name: string | null; last_name: string | null;
  email: string | null; phone_number: string | null;
};
type SourceBase = {
  id: CustomerRecordId; created_at: string | null; client: Relation<CustomerClient>;
};
export type InquiryInboxRow = SourceBase & {
  project_table: Relation<{ title: string | null }>;
  admin_inquire_reads: { admin_id: CustomerRecordId }[] | null;
};
export type SupportInboxRow = SourceBase & {
  'type of inquiry': string | null; message: string | null;
  admin_contact_reads: { admin_id: CustomerRecordId }[] | null;
};
export type LoanInboxRow = SourceBase & {
  project_table: Relation<{ title: string | null }>;
  banks: Relation<{ bank_name: string | null }>;
  tower: string | null; unit_no: number | null; floor_no: number | null;
  co_buyer_name: string | null; is_agreed: boolean | null;
  admin_loan_preapp_reads: { admin_id: CustomerRecordId }[] | null;
};

export const customerInboxTypeLabels: Record<CustomerInboxItemType, string> = {
  inquiry: 'Property Inquiry',
  loan_application: 'Loan Application',
  customer_support: 'Customer Support',
};

function related<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function sender(row: SourceBase) {
  const client = related(row.client);
  return {
    id: row.id,
    created_at: row.created_at,
    name: [client?.first_name, client?.last_name].filter(Boolean).join(' ').trim() || 'Unknown customer',
    client_email: client?.email ?? null,
    client_phone: client?.phone_number ?? null,
  };
}

export function normalizeCustomerInbox(
  inquiries: InquiryInboxRow[], support: SupportInboxRow[], loans: LoanInboxRow[], adminId: CustomerRecordId,
): CustomerInboxItem[] {
  const items: CustomerInboxItem[] = [
    ...inquiries.map((row): CustomerInboxItem => {
      const project_name = related(row.project_table)?.title || 'Unknown Property';
      return {
        ...sender(row), type: 'inquiry', title: `Inquiry: ${project_name}`, project_name,
        is_read: row.admin_inquire_reads?.some(read => String(read.admin_id) === String(adminId)) ?? false,
        can_mark_read: true,
      };
    }),
    ...support.map((row): CustomerInboxItem => ({
      ...sender(row), type: 'customer_support', title: row['type of inquiry'] || 'Customer Support',
      message: row.message ?? '',
      is_read: row.admin_contact_reads?.some(read => String(read.admin_id) === String(adminId)) ?? false,
      can_mark_read: true,
    })),
    ...loans.map((row): CustomerInboxItem => {
      const project_name = related(row.project_table)?.title || 'Unknown Property';
      return {
        ...sender(row), type: 'loan_application', title: `Loan Pre-Application: ${project_name}`,
        project_name, bank_name: related(row.banks)?.bank_name || 'Not provided',
        tower: row.tower, unit_no: row.unit_no, floor_no: row.floor_no,
        co_buyer_name: row.co_buyer_name, is_agreed: row.is_agreed,
        is_read: row.admin_loan_preapp_reads?.some(read => String(read.admin_id) === String(adminId)) ?? false,
        can_mark_read: true,
      };
    }),
  ];
  const timestamp = (value: string | null) => value ? Date.parse(value) || 0 : 0;
  return items.sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at)
    || customerInboxKey(a).localeCompare(customerInboxKey(b), undefined, { numeric: true }));
}

export function customerInboxKey(item: Pick<CustomerInboxItem, 'type' | 'id'>) {
  return `${item.type}-${item.id}`;
}

export function filterCustomerInbox(
  items: CustomerInboxItem[], search: string, type: CustomerInboxItemType | 'all', read: CustomerInboxReadFilter,
) {
  const query = search.trim().toLocaleLowerCase();
  return items.filter(item => {
    if (type !== 'all' && item.type !== type) return false;
    if (read === 'read' && !item.is_read || read === 'unread' && item.is_read) return false;
    const context = item.type === 'customer_support' ? [item.message]
      : item.type === 'loan_application' ? [item.project_name, item.bank_name] : [item.project_name];
    return !query || [item.name, item.client_email, item.client_phone, item.title, ...context]
      .some(value => value?.toLocaleLowerCase().includes(query));
  });
}

export function customerInboxContext(item: CustomerInboxItem) {
  return item.type === 'customer_support' ? item.title
    : item.type === 'loan_application' ? `${item.project_name} · ${item.bank_name}` : item.project_name;
}

export function formatCustomerInboxDate(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Date unavailable';
  return new Date(value).toLocaleString('en-US', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function customerInboxReplyHref(item: CustomerInboxItem) {
  const email = item.client_email?.trim();
  if (!email || !/^[^\s@<>?,;&]+@[^\s@<>?,;&]+\.[^\s@<>?,;&]+$/.test(email)) return null;
  const subject = item.type === 'loan_application'
    ? `RE: Loan Pre-Application - ${item.project_name}` : `RE: ${item.title}`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}`;
}