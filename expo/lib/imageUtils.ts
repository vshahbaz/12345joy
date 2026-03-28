const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const LOVABLE_BASE_URL = 'https://joydealer1.lovable.app';

const SUPABASE_STORAGE_IMAGES_PATTERN = /\/storage\/v1\/object\/public\/images\//;

function rewriteSupabaseImageUrl(url: string): string {
  const match = url.match(SUPABASE_STORAGE_IMAGES_PATTERN);
  if (match) {
    const filename = url.split('/storage/v1/object/public/images/').pop();
    if (filename) {
      const resolved = `${LOVABLE_BASE_URL}/images/${filename}`;
      console.log('[imageUtils] Rewrote Supabase storage URL to Lovable:', resolved);
      return resolved;
    }
  }
  return url;
}

export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url || url.trim().length === 0) {
    return null;
  }

  console.log('[imageUtils] Resolving URL:', url);

  if (url.startsWith('http://') || url.startsWith('https://')) {
    const rewritten = rewriteSupabaseImageUrl(url);
    if (rewritten !== url) return rewritten;

    if (url.includes('preview--joydealer1.lovable.app')) {
      const fixed = url.replace('preview--joydealer1.lovable.app', 'joydealer1.lovable.app');
      console.log('[imageUtils] Rewrote preview URL to production:', fixed);
      return fixed;
    }

    return url;
  }

  if (url.startsWith('//')) {
    const resolved = `https:${url}`;
    return rewriteSupabaseImageUrl(resolved);
  }

  const path = url.startsWith('/') ? url : `/${url}`;

  if (path.startsWith('/images/') || path.startsWith('/assets/')) {
    const resolved = `${LOVABLE_BASE_URL}${path}`;
    console.log('[imageUtils] Static asset resolved to:', resolved);
    return resolved;
  }

  if (supabaseUrl) {
    const base = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;

    if (path.startsWith('/storage/')) {
      const fullUrl = `${base}${path}`;
      const rewritten = rewriteSupabaseImageUrl(fullUrl);
      if (rewritten !== fullUrl) return rewritten;
      return fullUrl;
    }

    const fullUrl = `${base}/storage/v1/object/public${path}`;
    const rewritten = rewriteSupabaseImageUrl(fullUrl);
    if (rewritten !== fullUrl) return rewritten;
    return fullUrl;
  }

  console.warn('[imageUtils] Cannot resolve image URL, no supabase URL configured:', url);
  return null;
}
