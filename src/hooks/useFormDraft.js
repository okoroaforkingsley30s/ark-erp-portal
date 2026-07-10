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
  const restoredKeyRef = useRef(null);
  const clearedKeyRef = useRef(null);
  const previousEnabledRef = useRef(enabled);
  const skipNextSaveKeyRef = useRef(null);
  const formRef = useRef(form);
  const draftKey = getDraftKey(key, userId);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    if (!enabled && previousEnabledRef.current) {
      restoredKeyRef.current = null;
      skipNextSaveKeyRef.current = null;
    }

    if (enabled && !previousEnabledRef.current && clearedKeyRef.current === draftKey) {
      clearedKeyRef.current = null;
    }

    if (clearedKeyRef.current && clearedKeyRef.current !== draftKey) {
      clearedKeyRef.current = null;
    }

    previousEnabledRef.current = enabled;
  }, [draftKey, enabled]);

  useEffect(() => {
    if (!enabled || restoredKeyRef.current === draftKey) return;

    restoredKeyRef.current = draftKey;

    try {
      const savedDraft = localStorage.getItem(draftKey);

      if (!savedDraft) return;

      const parsedDraft = JSON.parse(savedDraft);

      if (parsedDraft?.form) {
        skipNextSaveKeyRef.current = draftKey;
        setForm(parsedDraft.form);
        onRestore?.(parsedDraft);
      }
    } catch (error) {
      console.error('Could not restore saved draft:', error);
    }
  }, [draftKey, enabled, setForm, onRestore]);

  useEffect(() => {
    if (
      !enabled ||
      restoredKeyRef.current !== draftKey ||
      clearedKeyRef.current === draftKey
    ) {
      return;
    }

    if (skipNextSaveKeyRef.current === draftKey) {
      skipNextSaveKeyRef.current = null;
      return;
    }

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

  useEffect(() => {
    if (
      !enabled ||
      restoredKeyRef.current !== draftKey ||
      clearedKeyRef.current === draftKey
    ) {
      return;
    }

    const saveCurrentDraft = () => {
      if (clearedKeyRef.current === draftKey) return;

      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            form: formRef.current,
            savedAt: new Date().toISOString(),
          })
        );
      } catch (error) {
        console.error('Could not save draft:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveCurrentDraft();
    };

    window.addEventListener('pagehide', saveCurrentDraft);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      saveCurrentDraft();
      window.removeEventListener('pagehide', saveCurrentDraft);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [draftKey, enabled]);

  const clearDraft = () => {
    try {
      clearedKeyRef.current = draftKey;
      localStorage.removeItem(draftKey);
    } catch (error) {
      console.error('Could not clear draft:', error);
    }
  };

  return { clearDraft };
}
