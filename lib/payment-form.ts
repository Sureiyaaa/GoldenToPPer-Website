export interface PaymentProject {
  project_name: string;
  project_id: number;
  merchant_id: string | null;
}

/**
 * Converts common Philippine mobile formats into the subscriber portion shown
 * beside the fixed +63 prefix. Prefixes are stripped repeatedly so pasted
 * values such as "+63 0917..." cannot produce a doubled country/local prefix.
 */
export function normalizePhilippineMobileSubscriber(value: string): string {
  let digits = value.replace(/\D/g, '');

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  let previous = '';
  while (digits !== previous) {
    previous = digits;
    if (digits.startsWith('63')) {
      digits = digits.slice(2);
    }
    if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }
  }

  return digits.slice(0, 10);
}

export function isValidPhilippineMobileSubscriber(value: string): boolean {
  return /^9\d{9}$/.test(value);
}

/** Preserve the existing payment action's 11-digit local-number contract. */
export function toPaymentApiContactNumber(subscriberNumber: string): string {
  return `0${normalizePhilippineMobileSubscriber(subscriberNumber)}`;
}

export function getProjectMerchantId(
  projectId: string,
  projects: PaymentProject[]
): string | null {
  if (!projectId) return null;
  return projects.find((project) => String(project.project_id) === projectId)?.merchant_id ?? null;
}
