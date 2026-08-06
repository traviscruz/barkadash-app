export interface PollOption {
  id: string;
  text: string;
  votes: number;
  votedBy: string[];
}

export interface Poll {
  id: string;
  question: string;
  createdBy: string;
  options: PollOption[];
  isClosed: boolean;
}
