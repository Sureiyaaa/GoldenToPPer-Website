export const DEFAULT_IMAGE_DISCLAIMER = "Architect's vision only.";

export default function ImageDisclaimer({
  enabled,
  text,
}: {
  enabled?: boolean;
  text?: string | null;
}) {
  if (!enabled) return null;

  return (
    <p className="pointer-events-none absolute bottom-3 right-3 z-10 max-w-[85%] whitespace-pre-wrap break-words rounded bg-black/65 px-2 py-1 text-right text-[10px] leading-relaxed text-white md:text-xs">
      {text?.trim() || DEFAULT_IMAGE_DISCLAIMER}
    </p>
  );
}
