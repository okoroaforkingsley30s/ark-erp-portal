-- Allow authenticated RR visibility policies to resolve the caller's profile.
-- The helper remains unavailable to anonymous and public callers.

revoke all on function public.ark_current_profile_id() from public, anon;
grant execute on function public.ark_current_profile_id() to authenticated;
