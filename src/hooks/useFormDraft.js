import { useEffect, useRef } from 'react';

function getDraftKey(key, userId) {
  return `ark-one:draft:${key}:${userId || 'anonymous'}`;
}

export function useFormDraft({
  key,
  form,
  setForm,
  userId,
  enabled = true,
  onRestore,
}) {
  const hasRestored = useRef(false);
  const draftKey = getDraftKey(key, userId);

  useEffect(() => {
    if (!enabled || hasRestored.current) return;

    hasRestored.current = true;

    try {
      const savedDraft = localStorage.getItem(draftKey);

      if (!savedDraft) return;

      const parsedDraft = JSON.parse(savedDraft);

      if (parsedDraft?.form) {
        setForm(parsedDraft.form);
        onRestore?.(parsedDraft);
      }
    } catch (error) {
      console.error('Could not restore saved draft:', error);
    }
  }, [draftKey, enabled, setForm, onRestore]);

  useEffect(() => {
    if (!enabled || !hasRestored.current) return;

    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          form,
          savedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.error('Could not save draft:', error);
    }
  }, [draftKey, form, enabled]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch (error) {
      console.error('Could not clear draft:', error);
    }
  };

  return { clearDraft };
}