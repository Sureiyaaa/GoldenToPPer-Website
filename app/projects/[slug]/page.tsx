import { createClient } from '@supabase/supabase-js';
import ProjectClient from './projectclient';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const formattedSlug = slug.startsWith('/') ? slug : `/${slug}`;
  
  const { data: project } = await supabase
    .from('project_table')
    .select('title, image')
    .ilike('slug', formattedSlug) 
    .maybeSingle(); 

  if (!project) {
    return { title: 'Project Not Found | Golden Topper' };
  }

  return {
    title: `${project.title} | Golden Topper`,
    description: `Discover ${project.title} by Golden Topper. Premium residential living designed for modern lifestyles.`,
    openGraph: {
      title: `${project.title} | Golden Topper`,
      url: `https://www.goldentopper.vercel.app/projects/${slug}`,
      siteName: 'Golden Topper',
      images: [{ url: project.image || '/images/placeholder.webp', width: 1200, height: 630 }],
    },
  };
}

export default async function DynamicProjectPage({ params }: Props) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const formattedSlug = slug.startsWith('/') ? slug : `/${slug}`;

  // Fetch the full project payload
  const { data: project, error } = await supabase
    .from('project_table')
    .select('*, amenities (*), unit_layout (*), project_tag(tags(tag_name))')
    .ilike('slug', formattedSlug) 
    .maybeSingle(); 

  if (error) {
    console.error("Supabase Query Error:", error.message);
  }

  if (!project) {
    console.error(`404 Triggered: Could not find project with slug: "${formattedSlug}"`);
    notFound(); 
  }

  const { data: extDesc } = await supabase
    .from('extended_description')
    .select('*')
    .eq('project_id', project.id);

  const finalData = { ...project, extended_description: extDesc || [] };

  return <ProjectClient initialProjectData={finalData} currentSlug={slug} />;
}