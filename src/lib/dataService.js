/**
 * ARK ONE - Centralized data service
 * Single source of truth for all operational data.
 * All modules must use these query keys and fetchers.
 */
import { supabase } from '@/lib/supabaseClient';

export const QUERY_KEYS = {
  banks: ['banks'],
  branches: ['branches'],
  devices: ['bankDevices'],
  engineers: ['engineers'],
  tickets: ['tickets'],
};

export const fetchBanks = async () => {
  const { data, error } = await supabase
    .from('banks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return data || [];
};

export const fetchBranches = async () => {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;
  return data || [];
};

export const fetchDevices = async () => {
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) throw error;
  return data || [];
};

export const fetchEngineers = async () => {
  const { data, error } = await supabase
    .from('engineers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return data || [];
};

export const fetchTickets = async (role, userEmail) => {
  let query = supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (role === 'client') {
    query = query.eq('client_email', userEmail).limit(100);
  }

  if (role === 'engineer') {
    query = query.eq('assigned_to', userEmail).limit(100);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
};