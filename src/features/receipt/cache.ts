// The receipt picture is only ever a cache file: the camera and the gallery picker both hand over a
// copy inside the app's own cache folder. It lives while the review is open (for the thumbnail) and
// is deleted when the review closes, is saved, or the scan fails. Only a file inside that cache
// folder is ever deleted, so the person's own photo in the gallery is never touched.
import { File, Paths } from 'expo-file-system';

// Deletes the picture at `uri` if it is a cached copy. Never throws; reports whether it is gone.
export function discardCachedImage(uri: string): boolean {
  try {
    const cache = Paths.cache.uri;
    const inCache = uri.startsWith(cache.endsWith('/') ? cache : `${cache}/`);
    if (!inCache) return false;
    const file = new File(uri);
    if (file.exists) file.delete();
    return !file.exists;
  } catch {
    return false;
  }
}
