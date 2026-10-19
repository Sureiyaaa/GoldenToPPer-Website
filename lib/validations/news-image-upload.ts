// Shared by the News uploader and its existing server upload action.
export const NEWS_IMAGE_STORAGE_CONFIG = {
  bucket: 'news_images',
  maxFileSize: 10 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
};

export function validateNewsImageFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  const config = NEWS_IMAGE_STORAGE_CONFIG;
  if (!config.allowedMimeTypes.includes(file.type)) {
    return `Invalid file type. Allowed types: ${config.allowedExtensions.join(', ')}`;
  }
  if (!config.allowedExtensions.includes(file.name.split('.').pop()?.toLowerCase() || '')) {
    return `Invalid file extension. Allowed types: ${config.allowedExtensions.join(', ')}`;
  }
  if (file.size > config.maxFileSize) {
    return `File too large. Maximum size: ${config.maxFileSize / (1024 * 1024)}MB`;
  }
  return null;
}
