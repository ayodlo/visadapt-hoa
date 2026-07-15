export interface Community {
  id: string;
  name: string;
}

export interface CommunityWithCounts extends Community {
  createdAt: string;
  _count: { users: number; communityAssignments: number; properties: number };
}

export interface MyCommunitiesResponse {
  communities: Community[];
  activeCommunityId: string | null;
}

export interface Property {
  id: string;
  streetAddress: string;
  unitNumber: string | null;
  city: string;
  state: string;
  zipCode: string;
}

export interface CreatePropertyInput {
  ownerId: string;
  streetAddress: string;
  unitNumber?: string;
  city: string;
  state: string;
  zipCode: string;
}
