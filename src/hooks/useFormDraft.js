import { useEffect, useRef } from 'react';

function getDraftKey(key, userId) {
  return `ark-one:draft:${key}:${userId || 'anonymous'}`;
}

export function clearBrowserDrafts() {
  const prefixes = ['ark-one:draft:', 'ark_one_create_ticket_draft_'];
  for (const storage of [localStorage, sessionStorage]) {
    Object.keys(storage)
      .filter((key) => prefixes.some((prefix) => key.startsWith(prefix)))
      .forEach((key) => storage.removeItem(key));
  }
}

export function useFormDraft({
  key,
  form,
  setForm,
  userId,
  enabled = true,
  onRestore,
  storage = 'session',
  maxAgeMs = 2 * 60 * 60 * 1000,
}) {
  const restoredKeyRef = useRef(null);
  const clearedKeyRef = useRef(null);
  const previousEnabledRef = useRef(enabled);
  const skipNextSaveKeyRef = useRef(null);
  const formRef = useRef(form);
  const draftKey = getDraftKey(key, userId);
  const draftStorage = storage === 'local' ? localStorage : sessionStorage;

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    if (storage !== 'local') localStorage.removeItem(draftKey);
  }, [draftKey, storage]);

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
      const savedDraft = draftStorage.getItem(draftKey);

      if (!savedDraft) return;

      const parsedDraft = JSON.parse(savedDraft);

      const savedAt = new Date(parsedDraft?.savedAt || 0).getTime();
      if (!savedAt || Date.now() - savedAt > maxAgeMs) {
        draftStorage.removeItem(draftKey);
        return;
      }

      if (parsedDraft?.form) {
        skipNextSaveKeyRef.current = draftKey;
        setForm(parsedDraft.form);
        onRestore?.(parsedDraft);
      }
    } catch (error) {
      console.error('Could not restore saved draft:', error);
    }
  }, [draftKey, draftStorage, enabled, maxAgeMs, onRestore, setForm, storage]);

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
      draftStorage.setItem(
        draftKey,
        JSON.stringify({
          form,
          savedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.error('Could not save draft:', error);
    }
  }, [draftKey, draftStorage, form, enabled]);

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
        draftStorage.setItem(
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
  }, [draftKey, draftStorage, enabled]);

  const clearDraft = () => {
    try {
      clearedKeyRef.current = draftKey;
      draftStorage.removeItem(draftKey);
      localStorage.removeItem(draftKey);
    } catch (error) {
      console.error('Could not clear draft:', error);
    }
  };

  return { clearDraft };
}
