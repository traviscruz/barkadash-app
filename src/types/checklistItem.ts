export type ChecklistCategory =
  | 'Essentials'
  | 'Hygiene & Toiletries'
  | 'Clothing & Footwear'
  | 'Electronics'
  | 'Health & Meds'
  | 'Group & Activities'
  | 'Other';

export const CHECKLIST_CATEGORIES: ChecklistCategory[] = [
  'Essentials',
  'Hygiene & Toiletries',
  'Clothing & Footwear',
  'Electronics',
  'Health & Meds',
  'Group & Activities',
  'Other',
];

export interface ChecklistItem {
  id: string;
  tripId: string;
  title: string;
  category: ChecklistCategory | string;
  isCompleted: boolean;
  assignedTo?: string;
  assignedToName?: string;
  assignedToAvatarUrl?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}
