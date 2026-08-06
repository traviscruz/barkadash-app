export interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarInitials: string;
  role: 'Leader' | 'Member';
  bio?: string;
}
