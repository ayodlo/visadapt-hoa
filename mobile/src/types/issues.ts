import type { IssueCategory, IssueStatus, IssuePriority, AuthorRef } from './enums';

export interface IssueSummary {
  id: string;
  category: IssueCategory;
  title: string;
  location: string;
  priority: IssuePriority;
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
  assignedTo: { firstName: string; lastName: string } | null;
  vendor: { name: string } | null;
  _count: { comments: number };
}

export interface IssueComment {
  id: string;
  issueId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: AuthorRef;
}

export interface IssueActivity {
  id: string;
  issueId: string;
  actorId: string | null;
  action: string;
  details: string | null;
  createdAt: string;
  actor: AuthorRef | null;
}

export interface IssueDetail {
  id: string;
  residentId: string;
  propertyId: string | null;
  vendorId: string | null;
  assignedToId: string | null;
  category: IssueCategory;
  title: string;
  description: string;
  location: string;
  priority: IssuePriority;
  status: IssueStatus;
  preferredContactMethod: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  resident: { id: string; firstName: string; lastName: string; email: string };
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  vendor: { id: string; name: string; contactName: string | null; phone: string | null } | null;
  comments: IssueComment[];
  activities: IssueActivity[];
}

export interface CreateIssueInput {
  category: IssueCategory;
  title: string;
  description: string;
  location: string;
  priority?: IssuePriority;
  preferredContactMethod: 'Email' | 'Phone' | 'Text';
}
