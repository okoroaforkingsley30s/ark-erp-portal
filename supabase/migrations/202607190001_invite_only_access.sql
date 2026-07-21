-- ARK ONE accounts are administrator-created and invitation-only.
-- Remove the obsolete authenticated self-registration RPC after the UI has
-- switched to administrator-issued invitations.

drop function if exists public.ark_register_current_user(text);
