import { z } from "zod";
import { validateArticleContent } from "./article-validation";

export const NewsSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  date: z.string().min(1, "Date is required"),
  category: z.string().min(1, "Please select a category"),
  image: z.string().optional(),
  // Optional here so unrelated partial updates never reset a saved preference.
  show_cover_on_article: z.boolean().optional(),
  excerpt: z.string().min(10, "Description must be at least 10 characters"),
  slug: z.string().min(1, "Slug is required (e.g., /news/your-title)"),
  // Rich text article content (optional; when present, excerpt is derived from it)
  article_content: z
    .string()
    .nullable()
    .optional()
    .refine(
      (val) => !val || validateArticleContent(val),
      { message: "Invalid article content format or too short" }
    ),
});

export type NewsFormValues = z.infer<typeof NewsSchema>;
