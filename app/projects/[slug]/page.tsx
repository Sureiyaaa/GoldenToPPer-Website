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
    .select('*, amenities (*), unit_layout (*), project_tag(tags(tag_name)), virtual_tours (*)')
    .ilike('slug', formattedSlug) 
    .maybeSingle(); 

  if (error) {
    console.error('[DynamicProjectPage] Project query failed:', error.message);
  }

  if (!project) {
    notFound();
  }

  // Fetch extended description, towers, virtual tours, and all other projects for the dropdown
  const [extendedDescriptionResult, towerResult, virtualTourResult, allProjectsResult] = await Promise.all([
    supabase
      .from('extended_description')
      .select('*')
      .eq('project_id', project.id),

    towerSupabase
      .from('project_table')
      .select('id, title, slug, virtual_tour_url, virtual_tours (*)')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('id', { ascending: true }),

    towerSupabase
      .from('virtual_tours')
      .select('*')
      .eq('project_id', project.id),

    supabase
      .from('project_table')
      .select('id, title, slug')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('id', { ascending: true })
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

  if (virtualTourResult.error) {
    console.warn(
      '[DynamicProjectPage] Virtual tours query failed:',
      virtualTourResult.error.message
    );
  }

  const finalData = {
    ...project,
    extended_description: extendedDescriptionResult.data || [],
    project_towers: towerResult.data || [],
    virtual_tours: virtualTourResult.data || [], 
  };

  // Filter projects to only those with functional 360 tours (identical to /projects)
  const projectsWithTours = (allProjectsResult.data || [])
    .filter((p: any) => {
      const activeTours = (p.virtual_tours || []).filter(
        (t: any) => !t.status || t.status.toLowerCase() === 'active'
      );
      return activeTours.length > 0 || Boolean(p.virtual_tour_url);
    })
    .map((p: any) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
    }));

  return (
    <ProjectClient 
      initialProjectData={finalData} 
      currentSlug={slug} 
      allProjects={projectsWithTours} 
    />
  );
}
