import { createClient } from '@supabase/supabase-js';
import ProjectsClient from './projectsclient';
import type { Metadata } from 'next';

// SEO Configuration for the Projects Directory
export const metadata: Metadata = {
  title: 'Our Projects | Golden Topper',
  description:
    "Explore Golden Topper's premium real estate developments across the Philippines, including pre-selling and ready-for-occupancy properties.",
  openGraph: {
    title: 'Our Projects | Golden Topper',
    description:
      'Explore premium residential and commercial real estate developments by Golden Topper.',
    url: 'https://www.goldentopper.vercel.app/projects',
    siteName: 'Golden Topper',
    images: [
      {
        url: '/images/landingpage/BDC_Goldentopper.jpg',
        width: 1200,
        height: 630,
        alt: 'Golden Topper Projects Directory',
      },
    ],
    locale: 'en_PH',
    type: 'website',
  },
};

export const revalidate = 60;

function createPublicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function createTowerSupabase() {
  // project_towers is admin-managed and may be protected by RLS. This page is
  // a server component, so the service-role key can safely be used here when
  // available without exposing it to the browser bundle.
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export default async function ProjectsPage() {
  const supabase = createPublicSupabase();

  const { data, error } = await supabase
    .from('project_table')
    .select(`
      *,
      unit_layout (
        id,
        title,
        show_on_project_page,
        project_page_order
      ),
      project_tag (
        tags (
          tag_name
        )
      ),
      virtual_tours (*)
    `)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching projects on server:', error);
  }

  const projects = data || [];
  const projectIds = projects
    .map((project: any) => Number(project.id))
    .filter((id: number) => Number.isFinite(id));

  const towerOrderByProject = new Map<number, string[]>();

  if (projectIds.length > 0) {
    const towerSupabase = createTowerSupabase();
    const { data: towerRows, error: towerError } = await towerSupabase
      .from('project_towers')
      .select('id, project_id, name, sort_order')
      .in('project_id', projectIds)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (towerError) {
      // Keep the public page usable if the tower registry cannot be read. The
      // client has a deterministic legacy fallback based on tour tower names.
      console.warn(
        '[ProjectsPage] Unable to load project tower ordering:',
        towerError.message
      );
    } else {
      for (const row of towerRows || []) {
        const projectId = Number(row.project_id);
        const name = String(row.name || '').trim();
        if (!Number.isFinite(projectId) || !name) continue;

        const current = towerOrderByProject.get(projectId) || [];
        current.push(name);
        towerOrderByProject.set(projectId, current);
      }
    }
  }

  const serializedProjects = projects.map((item: any) => ({
    id: item.id,
    name: item.title,
    address: item.address,
    city: item.city,
    slug: item.slug,
    image: item.image || '/images/placeholder.webp',
    proximity: item.proximity,
    statusText: item.status || 'Pre-Selling',
    tags:
      item.project_tag
        ?.map((pt: any) => pt.tags?.tag_name)
        .filter(Boolean) || [],
    units: [
      ...new Set(
        (item.unit_layout || [])
          .filter((unit: any) => unit.show_on_project_page)
          .sort(
            (a: any, b: any) =>
              (a.project_page_order ?? Number.MAX_SAFE_INTEGER) -
              (b.project_page_order ?? Number.MAX_SAFE_INTEGER)
          )
          .map((unit: any) => unit.title)
      ),
    ] as string[],

    // Public Virtual Tours only receive units explicitly marked Active.
    // Sort by database id so the unit dropdown remains deterministic.
    virtual_tours:
      (item.virtual_tours || [])
        .filter((tour: any) => tour.status === 'Active')
        .sort((a: any, b: any) => Number(a.id) - Number(b.id)),

    // Canonical tower order comes from the same project_towers registry used
    // by the Project CMS and Virtual Tour admin editor.
    virtual_tour_tower_order:
      towerOrderByProject.get(Number(item.id)) || [],

    // Legacy one-panorama fallback remains supported.
    virtual_tour_url: item.virtual_tour_url || null,
  }));

  return <ProjectsClient initialProjects={serializedProjects} />;
}
