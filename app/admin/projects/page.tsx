// app/admin/projects/page.tsx
'use client';

import { getCurrentUser } from '@/app/actions/auth';
import { useState, useEffect, Suspense } from 'react';
import { saveProjectAction, fetchProjectForEdit } from '@/app/actions/projects';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Save, Loader2, PlusCircle, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import PreviewSkeleton from './PreviewSkeleton';
import ImageDropzone from '@/app/components/imagedropzone';
import { createClient } from '@/utils/supabase/client';

const projectSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required").startsWith("/", "Must start with a forward slash (/)"),
  status: z.string().min(1, "Status is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"), 
  sqm: z.string().min(1, "Total SQM is required"),
  unit_total: z.string().min(1, "Total Units is required"),
 
  image: z.string(), 
  img_awards: z.string(), 
  editorial_title: z.string().min(1, "Editorial title is required"),
  editorial_long: z.string().min(1, "Editorial description is required"),
  editorial_img: z.string(),
  editorial_title_color: z.string().optional(),
  editorial_desc_color: z.string().optional(),
  editorial_bg_color: z.string().optional(),
  amenities_title: z.string().optional(),
  amenities_title_gold: z.string().optional(),
  tags: z.array(z.object({ tag_name: z.string().min(1, "Tag cannot be empty") })),
  unit_layouts: z.array(z.object({
    title: z.string().min(1, "Title required"), description: z.string(), 
    min_sqm: z.string().min(1, "Required"), 
    max_sqm: z.string().min(1, "Required"), 
    thumbnail: z.string()
  })),
  amenities: z.array(z.object({
    title: z.string().min(1, "Title required"), description: z.string(), thumbnail: z.string()
  })),
  map_latitude: z.string().min(1, "Required"),
  map_longitude: z.string().min(1, "Required"),
  map_icon: z.string().optional(), // NEW: Main project map pin
  child_markers: z.array(z.object({
    interest_name: z.string().min(1, "Name required"), address: z.string(), phrase: z.string(), 
    distance_km: z.string().min(1, "Required"), 
    distance_drive: z.string().min(1, "Required"), 
    distance_walk: z.string().min(1, "Required"), 
    latitude: z.string().min(1, "Required"), 
    longitude: z.string().min(1, "Required"), 
    thumbnail: z.string(), marker_icon: z.string(), marker_type: z.string() // marker_icon is now a string URL
  })),
});

type ProjectFormData = z.infer<typeof projectSchema>;
const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

const ColorInputSync = ({ 
  label, 
  fieldName, 
  register, 
  watch, 
  setValue, 
  inputStyles, 
  labelStyles 
}: any) => {
  const currentColor = watch(fieldName);
  const [textValue, setTextValue] = useState(currentColor || '#000000');

  useEffect(() => {
    setTextValue(currentColor || '#000000');
  }, [currentColor]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setTextValue(newVal);
    if (/^#[0-9A-F]{6}$/i.test(newVal)) {
      setValue(fieldName, newVal, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setTextValue(newVal);
    setValue(fieldName, newVal, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <div>
      <label className={labelStyles}>{label}</label>
      <div className="flex items-center gap-2">
        <input 
          type="color" 
          value={currentColor || '#000000'} 
          onChange={handleColorPickerChange}
          className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0" 
        />
        <input 
          type="text" 
          value={textValue} 
          onChange={handleTextChange}
          placeholder="#FFFFFF"
          className={`${inputStyles} py-1 px-2 text-[10px] uppercase font-mono`} 
        />
        <input type="hidden" {...register(fieldName)} />
      </div>
    </div>
  );
};

function ProjectManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit'); 
  const supabase = createClient();
  
  const [isFetching, setIsFetching] = useState(!!editId); 
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    return () => Object.values(previews).forEach(url => URL.revokeObjectURL(url));
  }, [previews]);

  const { register, control, watch, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: "", slug: "", status: "", address: "", city: "", country: "Philippines",
      sqm: "", unit_total: "", image: "", img_awards: "", 
      editorial_title: "", editorial_long: "", editorial_img: "",
      editorial_title_color: "#132243", editorial_desc_color: "#4B5563", editorial_bg_color: "transparent",
      amenities_title: "Experience A Fresh", amenities_title_gold: "Way Of Living in this project.",
      tags: [], unit_layouts: [], amenities: [], map_latitude: "", map_longitude: "", map_icon: "", child_markers: []
    }
  });

  const { fields: tagFields, append: appendTag, remove: removeTag } = useFieldArray({ control, name: "tags" });
  const { fields: amenityFields, append: appendAmenity, remove: removeAmenity } = useFieldArray({ control, name: "amenities" });
  const { fields: layoutFields, append: appendLayout, remove: removeLayout } = useFieldArray({ control, name: "unit_layouts" });
  const { fields: markerFields, append: appendMarker, remove: removeMarker } = useFieldArray({ control, name: "child_markers" });

  useEffect(() => {
    const loadData = async () => {
      if (!editId) return; 

      try {
        setIsFetching(true);

        // ✅ USE THE SERVER ACTION TO BYPASS RLS AND FETCH HIDDEN PROJECTS
        const data = await fetchProjectForEdit(editId);

        if (!data.projData) throw new Error("Project not found or blocked.");

        const currentTags = data.tagData.map((pt: any) => ({ tag_name: pt.tags?.tag_name || "" }));

        reset({
          ...data.projData,
          country: data.projData.country || "Philippines",
          sqm: data.projData.sqm ? String(data.projData.sqm) : "",
          unit_total: data.projData.unit_total ? String(data.projData.unit_total) : "",
          map_latitude: data.parentData?.latitude ? String(data.parentData.latitude) : "",
          map_longitude: data.parentData?.longitude ? String(data.parentData.longitude) : "",
          map_icon: data.projData.map_icon || "", 
          
          // ✅ PREVENTS "EXPECTED STRING, RECEIVED NULL" ERRORS
          image: data.projData.image || "",
          img_awards: data.projData.img_awards || "",

          editorial_title: data.extData?.editorial_title || "",
          editorial_long: data.extData?.editorial_long || "",
          editorial_img: data.extData?.editorial_img || "",
          editorial_title_color: data.extData?.editorial_title_color || "#132243",
          editorial_desc_color: data.extData?.editorial_desc_color || "#4B5563",
          editorial_bg_color: data.extData?.editorial_bg_color || "transparent",
          amenities_title: data.extData?.amenities_title || "Experience A Fresh",
          amenities_title_gold: data.extData?.amenities_title_gold || `Way Of Living in ${data.projData.title || ''}.`,
          tags: currentTags,
          unit_layouts: data.layoutData.map((l: any) => ({ 
            ...l, 
            min_sqm: l.min_sqm ? String(l.min_sqm) : "", 
            max_sqm: l.max_sqm ? String(l.max_sqm) : "" 
          })),
          amenities: data.amenityData,
          child_markers: data.markerData.map((m: any) => ({
            ...m,
            distance_km: m.distance_km ? String(m.distance_km) : "",
            distance_drive: m.distance_drive ? String(m.distance_drive) : "",
            distance_walk: m.distance_walk ? String(m.distance_walk) : "",
            latitude: m.latitude ? String(m.latitude) : "",
            longitude: m.longitude ? String(m.longitude) : "",
            marker_icon: m.marker_type_table?.[0]?.icon || "", 
            marker_type: m.marker_type_table?.[0]?.name || "general"
          }))
        });

        const existingPreviews: Record<string, string> = {};
        if (data.projData.image) existingPreviews['image'] = data.projData.image;
        if (data.projData.img_awards) existingPreviews['img_awards'] = data.projData.img_awards;
        if (data.projData.map_icon) existingPreviews['map_icon'] = data.projData.map_icon;
        if (data.extData?.editorial_img) existingPreviews['editorial_img'] = data.extData.editorial_img;
        
        data.amenityData.forEach((a: any, i: number) => { if (a.thumbnail) existingPreviews[`amenities.${i}.thumbnail`] = a.thumbnail; });
        data.layoutData.forEach((l: any, i: number) => { if (l.thumbnail) existingPreviews[`unit_layouts.${i}.thumbnail`] = l.thumbnail; });
        data.markerData.forEach((m: any, i: number) => { 
          if (m.thumbnail) existingPreviews[`child_markers.${i}.thumbnail`] = m.thumbnail; 
          if (m.marker_type_table?.[0]?.icon && m.marker_type_table[0].icon.startsWith('http')) {
             existingPreviews[`child_markers.${i}.marker_icon`] = m.marker_type_table[0].icon;
          }
        });
        
        setPreviews(existingPreviews);

      } catch (error: any) {
        console.error("Fetch failed:", error.message);
      } finally {
        setIsFetching(false);
      }
    };

    loadData();
  }, [editId, reset]);

  const formData = watch();
  const hasErrors = Object.keys(errors).length > 0;

  const onSubmit = async (data: ProjectFormData) => {
    setIsSaving(true);
    try {
      let finalData = { ...data };

      // 1. UPLOAD IMAGES TO BUCKET (Kept on the client)
      for (const [path, file] of Object.entries(pendingFiles)) {
        const fileExt = file.name.split('.').pop();
        const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `projects/${uniqueFileName}`;
        
        const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('images').getPublicUrl(filePath);
        
        const keys = path.split('.');
        let current: any = finalData;
        for (let i = 0; i < keys.length - 1; i++) { current = current[keys[i]]; }

        // Clean up previously uploaded nested images inline if swapped before save
        const oldImageUrl = current[keys[keys.length - 1]];
        if (oldImageUrl && typeof oldImageUrl === 'string' && oldImageUrl.includes('/storage/v1/object/public/images/')) {
          const oldStoragePath = oldImageUrl.split('/storage/v1/object/public/images/')[1];
          if (oldStoragePath) {
            const { error: deleteError } = await supabase.storage.from('images').remove([oldStoragePath]);
            if (deleteError) console.warn("Failed to delete old image from storage:", deleteError);
          }
        }

        current[keys[keys.length - 1]] = publicUrlData.publicUrl;
      }

      // 2. PREPARE THE CLEAN DATA
      const cleanProjectData = {
        title: finalData.title, slug: finalData.slug, status: finalData.status, 
        address: finalData.address, city: finalData.city, country: finalData.country || "Philippines",
        sqm: finalData.sqm || null, unit_total: finalData.unit_total || null, 
        image: finalData.image, img_awards: finalData.img_awards || null,
        map_icon: finalData.map_icon || null
      };

      let targetProjectId = editId ? parseInt(editId) : null;

      // 3. CALL SERVER ACTION TO BYPASS RLS
      const result = await saveProjectAction({
        targetProjectId,
        cleanProjectData,
        finalData
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      setSuccessMsg(editId ? 'Project Updated Successfully!' : 'Project Published Successfully!');
      setTimeout(() => router.replace(`/admin/dashboard`), 2000);

    } catch (error: any) {
      alert(`Action Failed: ${error.message}`);
      setIsSaving(false);
    }
  };

  const previewData = {
    title: formData.title || 'Project Title',
    city: formData.city || 'City',
    country: formData.country || 'Country',
    sqm: formData.sqm || '0-0 SQM', 
    unit_total: formData.unit_total || '0 Units', 
    image: previews['image'] || formData.image || BLANK_IMAGE,
    img_awards: previews['img_awards'] || formData.img_awards || '',
    project_tag: formData.tags?.map((t) => ({ tags: { tag_name: t.tag_name } })) || [],
    extended_description: [{
      editorial_title: formData.editorial_title || 'Editorial Headline',
      editorial_long: formData.editorial_long || 'Write your project description here...',
      editorial_img: previews['editorial_img'] || formData.editorial_img || BLANK_IMAGE,
      editorial_title_color: formData.editorial_title_color,
      editorial_desc_color: formData.editorial_desc_color,
      editorial_bg_color: formData.editorial_bg_color,
      amenities_title: formData.amenities_title || 'Experience A Fresh',
      amenities_title_gold: formData.amenities_title_gold || `Way Of Living in ${formData.title || 'this project'}.`
    }],
    amenities: formData.amenities?.length > 0 ? formData.amenities.map((a, i) => ({
      id: i + 1, title: a.title || `Amenity ${i + 1}`, description: a.description || 'Description...', 
      thumbnail: previews[`amenities.${i}.thumbnail`] || a.thumbnail || BLANK_IMAGE
    })) : [],
    unit_layout: formData.unit_layouts?.length > 0 ? formData.unit_layouts.map((l, i) => ({
      id: i + 1, title: l.title || `Layout ${i + 1}`, description: l.description || 'Description...', 
      min_sqm: l.min_sqm || '0', max_sqm: l.max_sqm || '0', 
      thumbnail: previews[`unit_layouts.${i}.thumbnail`] || l.thumbnail || BLANK_IMAGE
    })) : []
  };

  const labelStyles = "text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1 mt-4";
  const inputStyles = "w-full border border-gray-200 rounded-lg p-3 text-sm focus:border-brand-gold outline-none transition-colors bg-gray-50 focus:bg-white";

  if (isFetching) {
    return <div className="flex h-screen w-full items-center justify-center bg-[#E7E7E7]"><Loader2 size={40} className="animate-spin text-brand-blue" /></div>;
  }

  return (
    <div className="flex h-screen w-full bg-[#E7E7E7] font-sans text-gray-900 overflow-hidden relative">
      
      {successMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-3 max-w-sm w-full mx-4">
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-2 shadow-inner">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Success!</h2>
            <p className="text-gray-600 text-center font-medium">{successMsg}</p>
          </div>
        </div>
      )}

      {/* LEFT SIDE: ADMIN FORM ENTRY */}
      <div className="w-[500px] shrink-0 bg-white p-8 overflow-y-auto border-r border-gray-200 shadow-2xl z-20 flex flex-col relative custom-scrollbar">
        <button onClick={() => router.push('/admin/dashboard')} className="flex items-center gap-2 text-[10px] text-gray-500 hover:text-brand-blue mb-8 font-bold uppercase tracking-widest transition-colors w-fit outline-none">
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        <h2 className="text-3xl font-serif text-brand-blue mb-8">{editId ? 'Edit Project' : 'Add New Project'}</h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-10 flex-1 pb-10">
          
          {/* Section 1: Basic Info */}
          <div>
            <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest border-b pb-2">Basic Info</h3>
            
            <label className={labelStyles}>Project Title</label>
            <input {...register("title")} placeholder="e.g. City Clou" className={inputStyles} />
            {errors.title && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.title.message}</p>}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelStyles}>URL Slug</label>
                <input {...register("slug")} placeholder="/cityclou" className={inputStyles} />
                {errors.slug && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.slug.message}</p>}
              </div>
              <div>
                <label className={labelStyles}>Status</label>
                <select {...register("status")} className={`${inputStyles} cursor-pointer`}>
                  <option value="">Select...</option>
                  <option value="Pre-Selling">Pre-Selling</option>
                  <option value="Ready for Occupancy">Ready for Occupancy</option>
                </select>
                {errors.status && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.status.message}</p>}
              </div>
            </div>

            <label className={labelStyles}>Street Address</label>
            <input {...register("address")} className={inputStyles} />
            {errors.address && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.address.message}</p>}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelStyles}>City</label>
                <input {...register("city")} className={inputStyles} />
                {errors.city && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.city.message}</p>}
              </div>
              <div>
                <label className={labelStyles}>Country</label>
                <input {...register("country")} className={inputStyles} />
                {errors.country && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.country.message}</p>}
              </div>
              <div>
                <label className={labelStyles}>Total SQM</label>
                <input type="text" {...register("sqm")} placeholder="e.g. 5000" className={inputStyles} />
                {errors.sqm && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.sqm.message}</p>}
              </div>
              <div>
                <label className={labelStyles}>Total Units</label>
                <input type="text" {...register("unit_total")} placeholder="e.g. 450" className={inputStyles} />
                {errors.unit_total && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.unit_total.message}</p>}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ImageDropzone 
                fieldPath="image" label="Main Hero Image" height="h-32"
                watch={watch} setValue={setValue} errors={errors} 
                setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} 
              />
              <ImageDropzone 
                fieldPath="img_awards" label="Awards Badge (Optional)" height="h-32"
                watch={watch} setValue={setValue} errors={errors} 
                setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} 
              />
            </div>
          </div>

          {/* Section 2: Tags */}
          <div>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest">Tags</h3>
              <button type="button" onClick={() => appendTag({ tag_name: "" })} className="text-[10px] text-brand-blue font-bold uppercase flex items-center gap-1"><PlusCircle size={12}/> Add Tag</button>
            </div>
            {tagFields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-center mt-3">
                <div className="flex-1">
                   <input {...register(`tags.${index}.tag_name`)} placeholder="e.g. Mixed Use" className={inputStyles} />
                   {errors?.tags?.[index]?.tag_name && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.tags[index]?.tag_name?.message}</p>}
                </div>
                <button type="button" onClick={() => removeTag(index)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>

          {/* Section 3: Editorial */}
          <div>
            <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest border-b pb-2">Editorial Section</h3>
            
            <div className="grid grid-cols-3 gap-4 mt-4 mb-4">
              <ColorInputSync 
                label="Bg Color" 
                fieldName="editorial_bg_color" 
                register={register} watch={watch} setValue={setValue} 
                inputStyles={inputStyles} labelStyles={labelStyles} 
              />
              <ColorInputSync 
                label="Headline" 
                fieldName="editorial_title_color" 
                register={register} watch={watch} setValue={setValue} 
                inputStyles={inputStyles} labelStyles={labelStyles} 
              />
              <ColorInputSync 
                label="Text" 
                fieldName="editorial_desc_color" 
                register={register} watch={watch} setValue={setValue} 
                inputStyles={inputStyles} labelStyles={labelStyles} 
              />
            </div>

            <label className={labelStyles}>Headline</label>
            <textarea 
              {...register("editorial_title")} 
              rows={2} 
              className={`${inputStyles} resize-none`} 
            />
            {errors.editorial_title && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.editorial_title.message}</p>}
                        
            <label className={labelStyles}>Long Description</label>
            <textarea {...register("editorial_long")} rows={4} className={`${inputStyles} resize-none`} />
            {errors.editorial_long && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.editorial_long.message}</p>}
            
            <div className="mt-4">
               <ImageDropzone 
                fieldPath="editorial_img" label="Editorial Image" height="h-32"
                watch={watch} setValue={setValue} errors={errors} 
                setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} 
              />
            </div>
          </div>

          {/* Section 4: Amenities */}
          <div>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest">Amenities</h3>
              <button type="button" onClick={() => appendAmenity({ title: "", description: "", thumbnail: "" })} className="text-[10px] text-brand-blue font-bold uppercase flex items-center gap-1"><PlusCircle size={12}/> Add Amenity</button>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 mb-6 p-4 bg-brand-blue/5 rounded-xl border border-brand-blue/10">
              <div>
                <label className={labelStyles}>Headline (White Text)</label>
                <input {...register("amenities_title")} placeholder="Experience A Fresh" className={inputStyles} />
              </div>
              <div>
                <label className={labelStyles}>Headline (Gold Text)</label>
                <input {...register("amenities_title_gold")} placeholder="Way Of Living in City Clou." className={inputStyles} />
              </div>
            </div>
            
            {amenityFields.map((field, index) => (
              <div key={field.id} className="p-4 mt-4 bg-gray-50 border border-gray-100 rounded-lg relative group">
                <button type="button" onClick={() => removeAmenity(index)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                
                <label className={labelStyles}>Amenity Name</label>
                <input {...register(`amenities.${index}.title`)} className={inputStyles} />
                {errors?.amenities?.[index]?.title && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.amenities[index]?.title?.message}</p>}
                
                <label className={labelStyles}>Description</label>
                <textarea {...register(`amenities.${index}.description`)} rows={2} className={`${inputStyles} resize-none`} />
                
                <div className="mt-4">
                  <ImageDropzone 
                    fieldPath={`amenities.${index}.thumbnail`} label="Thumbnail" height="h-24"
                    watch={watch} setValue={setValue} errors={errors} 
                    setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} 
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Section 5: Blueprints */}
          <div>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest">Unit Layouts</h3>
              <button type="button" onClick={() => appendLayout({ title: "", description: "", min_sqm: "", max_sqm: "", thumbnail: "" })} className="text-[10px] text-brand-blue font-bold uppercase flex items-center gap-1"><PlusCircle size={12}/> Add Layout</button>
            </div>
            
            {layoutFields.map((field, index) => (
              <div key={field.id} className="p-4 mt-4 bg-gray-50 border border-gray-100 rounded-lg relative group">
                <button type="button" onClick={() => removeLayout(index)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                
                <label className={labelStyles}>Layout Title</label>
                <input {...register(`unit_layouts.${index}.title`)} className={inputStyles} />
                {errors?.unit_layouts?.[index]?.title && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.unit_layouts[index]?.title?.message}</p>}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelStyles}>Min SQM</label>
                    <input type="text" {...register(`unit_layouts.${index}.min_sqm`)} className={inputStyles} />
                    {errors?.unit_layouts?.[index]?.min_sqm && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.unit_layouts[index]?.min_sqm?.message}</p>}
                  </div>
                  <div>
                    <label className={labelStyles}>Max SQM</label>
                    <input type="text" {...register(`unit_layouts.${index}.max_sqm`)} className={inputStyles} />
                    {errors?.unit_layouts?.[index]?.max_sqm && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.unit_layouts[index]?.max_sqm?.message}</p>}
                  </div>
                </div>

                <label className={labelStyles}>Description</label>
                <textarea {...register(`unit_layouts.${index}.description`)} rows={2} className={`${inputStyles} resize-none`} />
                
                <div className="mt-4">
                  <ImageDropzone 
                    fieldPath={`unit_layouts.${index}.thumbnail`} label="Floorplan Image" height="h-24"
                    watch={watch} setValue={setValue} errors={errors} 
                    setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} 
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Section 6: Map Markers */}
          <div>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest">Map Landmarks</h3>
              <button type="button" onClick={() => appendMarker({ interest_name: "", address: "", phrase: "", distance_km: "", distance_drive: "", distance_walk: "", latitude: "", longitude: "", thumbnail: "", marker_icon: "", marker_type: "general" })} className="text-[10px] text-brand-blue font-bold uppercase flex items-center gap-1"><PlusCircle size={12}/> Add Landmark</button>
            </div>
            
            {/* 1. UPDATED LAT/LNG LABELS */}
            <div className="grid grid-cols-2 gap-4 mt-4 mb-4">
              <div>
                <label className={labelStyles}>Project Location (Building Lat)</label>
                <input type="text" {...register("map_latitude")} className={inputStyles} />
                {errors.map_latitude && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.map_latitude.message}</p>}
              </div>
              <div>
                <label className={labelStyles}>Project Location (Building Lng)</label>
                <input type="text" {...register("map_longitude")} className={inputStyles} />
                {errors.map_longitude && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.map_longitude.message}</p>}
              </div>
            </div>

            {/* 2. MAIN PROJECT PIN UPLOAD */}
            <div className="mt-4 mb-8 p-4 bg-brand-blue/5 rounded-xl border border-brand-blue/10">
              <label className={labelStyles}>Main Project Map Pin (Transparent PNG or SVG)</label>
              <ImageDropzone 
                fieldPath="map_icon" 
                label="Upload Custom Project Pin" 
                height="h-32"
                watch={watch} 
                setValue={setValue} 
                errors={errors} 
                setPendingFiles={setPendingFiles} 
                setPreviews={setPreviews} 
                previews={previews} 
              />
            </div>

            {markerFields.map((field, index) => (
              <div key={field.id} className="p-4 mt-4 bg-gray-50 border border-gray-100 rounded-lg relative group">
                <button type="button" onClick={() => removeMarker(index)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                
                <label className={labelStyles}>Landmark Name</label>
                <input {...register(`child_markers.${index}.interest_name`)} className={inputStyles} />
                {errors?.child_markers?.[index]?.interest_name && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.child_markers[index]?.interest_name?.message}</p>}
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelStyles}>Address</label>
                    <input {...register(`child_markers.${index}.address`)} className={inputStyles} />
                  </div>
                  <div>
                    <label className={labelStyles}>Catchphrase</label>
                    <input {...register(`child_markers.${index}.phrase`)} className={inputStyles} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                   <div>
                      <label className={labelStyles}>KM</label>
                      <input type="text" {...register(`child_markers.${index}.distance_km`)} className={inputStyles} />
                      {errors?.child_markers?.[index]?.distance_km && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.child_markers[index]?.distance_km?.message}</p>}
                   </div>
                   <div>
                      <label className={labelStyles}>Drive (m)</label>
                      <input type="text" {...register(`child_markers.${index}.distance_drive`)} className={inputStyles} />
                      {errors?.child_markers?.[index]?.distance_drive && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.child_markers[index]?.distance_drive?.message}</p>}
                   </div>
                   <div>
                      <label className={labelStyles}>Walk (m)</label>
                      <input type="text" {...register(`child_markers.${index}.distance_walk`)} className={inputStyles} />
                      {errors?.child_markers?.[index]?.distance_walk && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.child_markers[index]?.distance_walk?.message}</p>}
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                   <div>
                      <label className={labelStyles}>Lat</label>
                      <input type="text" {...register(`child_markers.${index}.latitude`)} className={inputStyles} />
                      {errors?.child_markers?.[index]?.latitude && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.child_markers[index]?.latitude?.message}</p>}
                   </div>
                   <div>
                      <label className={labelStyles}>Lng</label>
                      <input type="text" {...register(`child_markers.${index}.longitude`)} className={inputStyles} />
                      {errors?.child_markers?.[index]?.longitude && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.child_markers[index]?.longitude?.message}</p>}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-2">
                   {/* 3. CHILD MARKER IMAGE DROPZONE (Replacing Select) */}
                   <div>
                      <label className={labelStyles}>Custom Map Icon</label>
                      <ImageDropzone 
                        fieldPath={`child_markers.${index}.marker_icon`} 
                        label="Upload Marker Icon" 
                        height="h-24"
                        watch={watch} 
                        setValue={setValue} 
                        errors={errors} 
                        setPendingFiles={setPendingFiles} 
                        setPreviews={setPreviews} 
                        previews={previews} 
                      />
                   </div>
                   <div>
                      <label className={labelStyles}>Tag (e.g. retail)</label>
                      <input {...register(`child_markers.${index}.marker_type`)} className={inputStyles} />
                   </div>
                </div>

                <div className="mt-4">
                  <ImageDropzone 
                    fieldPath={`child_markers.${index}.thumbnail`} label="Landmark Photo" height="h-24"
                    watch={watch} setValue={setValue} errors={errors} 
                    setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} 
                  />
                </div>
              </div>
            ))}
          </div>

          {hasErrors && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center gap-3 text-xs font-bold mt-4">
              <AlertCircle size={16} /> Please fill in all required fields marked in red above.
            </div>
          )}

          <button 
            type="submit" disabled={isSaving || isSubmitting}
            className="flex items-center justify-center gap-2 bg-brand-blue text-white py-5 rounded-xl uppercase tracking-widest font-bold text-[11px] hover:bg-brand-gold transition-colors shadow-xl w-full disabled:opacity-70 mt-6 mb-4"
          >
            {(isSaving || isSubmitting) ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {editId ? 'Update & Save Project' : 'Upload & Publish Project'}
          </button>

        </form>
      </div>

      {/* RIGHT SIDE: LIVE GSAP SKELETON PREVIEW */}
      <div id="preview-scroller" className="flex-1 overflow-y-auto relative scroll-smooth bg-black custom-scrollbar">
        <div className="fixed top-6 right-8 z-50 pointer-events-none">
          <span className="px-4 py-2 bg-white/90 backdrop-blur-md border border-brand-gold/50 text-[10px] font-bold text-brand-blue uppercase tracking-widest rounded-full shadow-2xl">
            Live Preview Mode
          </span>
        </div>
        <PreviewSkeleton data={previewData} />
      </div>

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#E7E7E7]"><Loader2 size={40} className="animate-spin text-brand-blue" /></div>}>
      <ProjectManager />
    </Suspense>
  );
}