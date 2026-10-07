import { z } from 'zod';

const integerString = (message: string, minimum: number) =>
  z.string().trim().min(1, message).regex(/^\d+$/, message).refine(
    value => Number.isSafeInteger(Number(value)) &&
      Number(value) >= minimum && Number(value) <= 2147483647,
    message,
  );

const name = (message: string, minimum: number) =>
  z.string().trim().min(minimum, message).max(200, 'Name is too long')
    .transform(value => value.replace(/\s+/g, ' '));

// Pure validation shared by the browser form and its server action.
export const loanSchema = z.object({
  condo: integerString('Please select a valid project', 1),
  bank: integerString('Please select a valid preferred bank', 1),
  tower: z.string().trim().min(1, 'Please select a tower').max(100, 'Tower is too long'),
  unit: integerString('Enter a valid non-negative whole unit number', 0),
  floor: integerString('Enter a valid non-negative whole floor number', 0),
  buyerName: name('Please enter a valid full name', 2),
  coBuyerName: name('Co-buyer name is required (or NA)', 1),
  email: z.string().trim().toLowerCase().max(254, 'Email is too long')
    .email('Please enter a valid email address'),
  phone: z.string().trim().regex(/^(09|\+639)\d{9}$/, 'Enter a valid PH mobile number'),
  isAgreed: z.boolean().refine(value => value === true, {
    message: 'You must agree to the Terms and Conditions',
  }),
});

export type LoanFormData = z.infer<typeof loanSchema>;
