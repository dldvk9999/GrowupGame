import { supabase } from './supabaseClient';

export const MAX_FRIENDS = 100;
const PAGE_SIZE = 20;

/** UID로 친구 요청 보내기 */
export async function sendFriendRequest(targetId) {
  const { error } = await supabase.rpc('send_friend_request', { p_target_id: targetId });
  if (error) throw new Error(error.message);
}

export async function acceptFriendRequest(requesterId) {
  const { error } = await supabase.rpc('accept_friend_request', { p_requester_id: requesterId });
  if (error) throw new Error(error.message);
}

export async function rejectFriendRequest(requesterId) {
  const { error } = await supabase.rpc('reject_friend_request', { p_requester_id: requesterId });
  if (error) throw new Error(error.message);
}

export async function cancelFriendRequest(targetId) {
  const { error } = await supabase.rpc('cancel_friend_request', { p_target_id: targetId });
  if (error) throw new Error(error.message);
}

export async function removeFriend(friendId) {
  const { error } = await supabase.rpc('remove_friend', { p_friend_id: friendId });
  if (error) throw new Error(error.message);
}

/** 친구 목록 페이지(0부터 시작) - { friends, totalCount } */
export async function fetchMyFriends(page = 0) {
  const { data, error } = await supabase.rpc('fetch_my_friends', { p_page: page });
  if (error) throw error;
  const rows = data ?? [];
  return {
    friends: rows.map((r) => ({ friendId: r.friend_id, nickname: r.nickname, equippedTitle: r.equipped_title })),
    totalCount: rows[0]?.total_count ?? 0,
  };
}

export async function fetchIncomingFriendRequests() {
  const { data, error } = await supabase.rpc('fetch_incoming_friend_requests');
  if (error) throw error;
  return (data ?? []).map((r) => ({ requesterId: r.requester_id, nickname: r.nickname, createdAt: r.created_at }));
}

export async function fetchOutgoingFriendRequests() {
  const { data, error } = await supabase.rpc('fetch_outgoing_friend_requests');
  if (error) throw error;
  return (data ?? []).map((r) => ({ targetId: r.target_id, nickname: r.nickname, createdAt: r.created_at }));
}

export const FRIEND_PAGE_SIZE = PAGE_SIZE;
