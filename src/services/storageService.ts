import { supabase } from '../utils/supabase';
import * as FileSystem from 'expo-file-system';

const BUCKET = 'expense-receipts';

export interface UploadedPhoto {
  path: string;
  url: string;
}

const extFor = (uri: string): string => {
  const clean = uri.split('?')[0];
  const m = /\.([a-zA-Z0-9]+)$/.exec(clean);
  return m ? m[1].toLowerCase() : 'jpg';
};

const decodeBase64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const uploadExpensePhotos = async (uris: string[], overrideUserId?: string): Promise<UploadedPhoto[]> => {
  if (!uris.length) return [];

  let userId = overrideUserId;
  if (!userId) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      userId = sessionData?.session?.user?.id ?? 'anon';
    } catch {
      userId = 'anon';
    }
  }

  const uploaded: UploadedPhoto[] = [];
  for (const uri of uris) {
    if (!uri) continue;
    // If it's already a remote public URL, keep it
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      uploaded.push({ path: uri, url: uri });
      continue;
    }

    try {
      let fileBytes: Uint8Array | ArrayBuffer | null = null;
      const ext = extFor(uri);
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      // 1. Try reading via FileSystem as base64
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
        if (base64) {
          fileBytes = decodeBase64ToUint8Array(base64);
        }
      } catch (fsErr) {
        console.warn('FileSystem read error, trying fetch blob:', fsErr);
      }

      // 2. Fallback to fetch blob
      if (!fileBytes) {
        const response = await fetch(uri);
        const blob = await response.blob();
        fileBytes = await new Response(blob).arrayBuffer();
      }

      if (!fileBytes || (fileBytes instanceof Uint8Array && fileBytes.length === 0)) {
        throw new Error('Empty file content');
      }

      const path = `${userId}/${Date.now()}_${uploaded.length}.${ext}`;

      const { data: uploadData, error } = await supabase.storage.from(BUCKET).upload(path, fileBytes, {
        contentType,
        upsert: true,
      });

      if (error) {
        console.warn('supabase storage upload error:', error.message);
        // If storage upload fails, fallback to local uri so user is not blocked
        uploaded.push({ path: uri, url: uri });
        continue;
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path || path);
      uploaded.push({ path: uploadData.path || path, url: pub.publicUrl });
    } catch (e) {
      console.warn('uploadExpensePhoto catch error:', e);
      uploaded.push({ path: uri, url: uri });
    }
  }
  return uploaded;
};

export const deleteExpensePhotos = async (paths: string[]): Promise<void> => {
  if (!paths.length) return;
  const cleanPaths = paths
    .map((p) => {
      if (!p) return '';
      if (p.includes(`${BUCKET}/`)) {
        return p.split(`${BUCKET}/`)[1].split('?')[0];
      }
      return p;
    })
    .filter((p) => p && !p.startsWith('http'));

  if (!cleanPaths.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(cleanPaths);
  if (error) console.warn('deleteExpensePhotos error:', error);
};

export const receiptPublicUrl = (path: string): string => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
};
