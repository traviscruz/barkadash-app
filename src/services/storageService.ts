import { supabase } from '../utils/supabase';
import { File } from 'expo-file-system';

const BUCKET = 'expense-receipts';

export interface UploadedPhoto {
  path: string;
  url: string;
}

const extFor = (uri: string, ext: string): string => {
  if (ext) return ext;
  const m = /\.([a-zA-Z0-9]+)$/.exec(uri.split('?')[0]);
  return m ? m[1].toLowerCase() : 'jpg';
};

export const uploadExpensePhotos = async (uris: string[]): Promise<UploadedPhoto[]> => {
  if (!uris.length) return [];

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id ?? 'anon';

  const uploaded: UploadedPhoto[] = [];
  for (const uri of uris) {
    try {
      const file = new File(uri);
      const buffer = await file.arrayBuffer();
      if (!buffer.byteLength) throw new Error('Empty file read');

      const ext = extFor(uri, file.extension.replace('.', ''));
      const path = `${userId}/${Date.now()}_${uploaded.length}.${ext}`;
      const contentType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

      const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
        contentType,
        upsert: false,
      });
      if (error) throw error;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      uploaded.push({ path, url: pub.publicUrl });
    } catch (e) {
      console.warn('uploadExpensePhoto error:', e);
    }
  }
  return uploaded;
};

export const deleteExpensePhotos = async (paths: string[]): Promise<void> => {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) console.warn('deleteExpensePhotos error:', error);
};

export const receiptPublicUrl = (path: string): string =>
  supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
