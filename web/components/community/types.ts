export type FeedPost = {
  id: string; kind: 'post' | 'blog' | 'result' | 'shot'; title: string | null; body: string | null;
  media: { type: 'image' | 'video'; path: string }[]; place: string | null; lat: number | null; lng: number | null;
  result: { exam_slug: string; title: string; score: number; max: number; percent: number; correct: number; wrong: number; rank: number | null; total: number | null; paper_id: string | null } | null;
  likes: number; dislikes: number; comments: number; shares: number; created_at: string; edited_at: string | null;
  author_id: string; author_name: string; author_username: string | null; author_avatar: string | null; author_verified: boolean;
  college_id: string | null; college_name: string | null; college_slug: string | null; my_reaction: number; is_mine: boolean; author_followed?: boolean;
};
export const fullDate = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
