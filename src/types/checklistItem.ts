export interface ChecklistItem {
  id: string;
  title: string;
  assignedTo?: string;
  isCompleted: boolean;
  category: string;
}
