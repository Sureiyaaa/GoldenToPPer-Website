// app/page.tsx
import { createClient } from '@supabase/supabase-js'; 
import HomeClient from './homeclient';
import HomepageDefaults from './data/homepage.json';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Golden Topper',
  description: 'Golden Topper develops prime real estate projects, elevating lifestyles and creating better communities across the Philippines.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0; 

export default async function HomePage() {
  // Use service role key if available on server, otherwise fallback to anon key
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey
  );

  const [newsRes, projectsRes, settingsRes, heroRes, devAreasRes, processRes, awardsRes] = await Promise.all([
    supabase.from('news_updates').select('*').order('date', { ascending: false }).limit(4),
    supabase.from('project_table').select('id, title, slug, image, virtual_tours (*)').is('deleted_at', null).eq('is_active', true).order('id', { ascending: true }),
    supabase.from('homepage_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('homepage_hero_slides').select('*, project_table(id, title, slug)').eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('homepage_development_areas').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('homepage_process_steps').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('homepage_awards').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
  ]);

  if (heroRes.error) {
    console.error("Error fetching homepage_hero_slides:", heroRes.error.message);
  }

  const formattedProjects = (projectsRes.data || []).map((project: any) => ({
    id: project.id,
    name: project.title,
    title: project.title,
    slug: project.slug,
    virtual_tours: (project.virtual_tours || []).filter(
      (tour: any) => !tour.status || tour.status.toLowerCase() === 'active'
    ),
  }));

  const heroSlides = (heroRes.data && heroRes.data.length > 0)
    ? heroRes.data.map((slide: any) => ({
        id: slide.id,
        title: slide.project_table?.title || slide.heading_line_1,
        slug: slide.project_table?.slug || '',
        headingLine1: slide.heading_line_1,
        headingLine2: slide.heading_line_2,
        location: slide.location,
        img: slide.image,
      }))
    : HomepageDefaults.heroProjects;

  const developmentAreas = (devAreasRes.data && devAreasRes.data.length > 0)
    ? devAreasRes.data.map((area: any) => ({
        id: area.tab_number,
        tabTitle: area.tab_title,
        subtitle: area.subtitle,
        heading: area.heading,
        desc: area.description,
        img: area.image,
      }))
    : HomepageDefaults.developmentAreas;

  const processSteps = (processRes.data && processRes.data.length > 0)
    ? processRes.data.map((step: any) => ({
        num: step.step_number,
        title: step.title,
        desc: step.description,
        img: step.image,
      }))
    : [
        { num: "01", title: "Creating Better Communities", desc: "Golden Topper is a fast-emerging group of real estate companies working in collaboration to develop prime real estate projects across the Philippines.", img: "/images/landingpage/communities.webp" },
        { num: "02", title: "Elevating lifestyles", desc: "Creating living spaces that are more than the ordinary, Golden Topper aims to deliver diverse living spaces catering to the needs of every homeowner.", img: "/images/landingpage/lifestyle.webp" },
        { num: "03", title: "Providing high-value investments", desc: "Creating living spaces that are more than the ordinary, Golden Topper aims to deliver diverse living spaces catering to the needs of every homeowner.", img: "/images/landingpage/investment.webp" }
      ];

  const awardsData = (awardsRes.data && awardsRes.data.length > 0)
    ? awardsRes.data.map((award: any) => ({
        id: award.id,
        title: award.title,
        subtitle1: award.subtitle_1,
        subtitle2: award.subtitle_2 || '',
        icon_image: award.icon_image,
      }))
    : HomepageDefaults.awardsData;

  const liveContent = {
    settings: settingsRes.data || {},
    heroSlides,
    developmentAreas,
    processSteps,
    awardsData,
  };

  return (
    <HomeClient 
      initialNews={newsRes.data || []} 
      initialProjects={formattedProjects}
      initialHomeContent={liveContent || {}} 
    />
  );
}