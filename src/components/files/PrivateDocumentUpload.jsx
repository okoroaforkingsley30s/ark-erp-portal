import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { safeUploadName } from '@/lib/fileValidation';
import { storageReference, usePrivateStorageUrl } from '@/hooks/usePrivateStorageUrl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ALLOWED = new Set([
  'application/pdf','image/jpeg','image/png','image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function PrivateDocumentLink({ value, children = 'View document', className = '' }) {
  const url = usePrivateStorageUrl(value, 'private-documents');
  if (!value) return null;
  if (!url) return <span className={className}>Document unavailable</span>;
  return <a href={url} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
}

export default function PrivateDocumentUpload({ value, onChange, category = 'supporting-document', retentionYears = 7 }) {
  const [uploading, setUploading] = useState(false);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    let path;
    try {
      setUploading(true);
      if (!ALLOWED.has(file.type)) throw new Error('Upload a PDF, DOCX, JPEG, PNG, or WebP document.');
      if (file.size<=0 || file.size>15*1024*1024) throw new Error('Documents must be 15 MB or smaller.');
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.id) throw new Error('Authentication is required.');
      path=`${authData.user.id}/${category}/${crypto.randomUUID()}-${safeUploadName(file.name)}`;
      const { error: uploadError }=await supabase.storage.from('private-documents').upload(path,file,{upsert:false});
      if (uploadError) throw uploadError;
      const { error: registryError }=await supabase.rpc('ark_register_private_document',{
        p_object_path:path,p_category:category,p_original_name:file.name,p_mime_type:file.type,
        p_file_size:file.size,p_retention_years:retentionYears,
      });
      if (registryError) {
        await supabase.storage.from('private-documents').remove([path]);
        throw registryError;
      }
      onChange(storageReference('private-documents',path));
    } catch (error) {
      alert(error.message || 'Document upload failed.');
    } finally {
      setUploading(false);
      event.target.value='';
    }
  };

  return <div className="space-y-2">
    <Input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp" onChange={upload} disabled={uploading} />
    {uploading && <p className="text-xs text-muted-foreground">Uploading securely…</p>}
    {value && <div className="flex items-center gap-2">
      <PrivateDocumentLink value={value} className="text-xs text-primary underline" />
      <Button type="button" size="sm" variant="ghost" onClick={()=>onChange('')}>Remove</Button>
    </div>}
  </div>;
}
