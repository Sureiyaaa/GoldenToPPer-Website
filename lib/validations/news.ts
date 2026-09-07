import { z } from "zod";

export const NewsSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  date: z.string().min(1, "Date is required"),
  category: z.string().min(1, "Please select a category"),
  image: z.string().optional(), // Optional because we handle the file upload separately
  excerpt: z.string().min(10, "Description must be at least 10 characters"),
  slug: z.string().min(1, "Slug is required (e.g., /news/your-title)"),
});

export type NewsFormValues = z.infer<typeof NewsSchema>;