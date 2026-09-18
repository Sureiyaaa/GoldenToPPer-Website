import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProjectClient from './projectclient';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://www.goldentopper.vercel.app';

function createPublicSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function createTowerSupabase() {
  // project_towers is an admin-managed registry with RLS enabled.
  // On the server we can use the existing service-role key when available
  // so the public project page can still respect the CMS tower ordering.
  return createClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function formatSlug(slug: string) {
  return slug.startsWith('/') ? slug : `/${slug}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createPublicSupabase();
  const formattedSlug = formatSlug(slug);

  const { data: project } = await supabase
    .from('project_table')
    .select('title, image')
    .ilike('slug', formattedSlug)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (!project) {
    return {
      title: 'Project Not Found | Golden Topper',
    };
  }

  const projectUrl = `${SITE_URL}/projects/${slug}`;
  const description = `Discover ${project.title} by Golden Topper. Premium residential living designed for modern lifestyles.`;

  return {
    title: `${project.title} | Golden Topper`,
    description,
    alternates: {
      canonical: projectUrl,
    },
    openGraph: {
      title: `${project.title} | Golden Topper`,
      description,
      url: projectUrl,
      siteName: 'Golden Topper',
      type: 'website',
      images: [
        {
          url: project.image || '/images/placeholder.webp',
          width: 1200,
          height: 630,
          alt: project.title,
        },
      ],
    },
  };
}

export default async function DynamicProjectPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createPublicSupabase();
  const towerSupabase = createTowerSupabase();
  const formattedSlug = formatSlug(slug);

  const { data: project, error } = await supabase
    .from('project_table')
    .select(
      `
        *,
        amenities (*),
        unit_layout (*),
        project_tag (
          tags (tag_name)
        )
      `
    )
    .ilike('slug', formattedSlug)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('[DynamicProjectPage] Project query failed:', error.message);
  }

  if (!project) {
    notFound();
  }

  const [extendedDescriptionResult, towerResult] = await Promise.all([
    supabase
      .from('extended_description')
      .select('*')
      .eq('project_id', project.id),

    towerSupabase
      .from('project_towers')
      .select('id, project_id, name, sort_order')
      .eq('project_id', project.id)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true }),
  ]);

  if (extendedDescriptionResult.error) {
    console.error(
      '[DynamicProjectPage] Extended description query failed:',
      extendedDescriptionResult.error.message
    );
  }

  if (towerResult.error) {
    console.warn(
      '[DynamicProjectPage] Tower registry query failed; falling back to layout data:',
      towerResult.error.message
    );
  }

  const finalData = {
    ...project,
    extended_description: extendedDescriptionResult.data || [],
    project_towers: towerResult.data || [],
  };

  return <ProjectClient initialProjectData={finalData} currentSlug={slug} />;
}
