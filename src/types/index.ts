export type VoteChoice = "available" | "maybe" | "unavailable";
export type GroupStatus = "voting" | "confirmed" | "completed";
export type FriendshipStatus = "pending" | "accepted";

export type User = {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  statusMessage: string | null;
};

export type Group = {
  id: string;
  name: string;
  hostId: string;
  status: GroupStatus;
  confirmedDate: string | null;
  placeId: string | null;
  createdAt: string;
  members: User[];
};

export type VoteSession = {
  id: string;
  groupId: string;
  candidateDates: string[];  // "YYYY-MM-DD"
  deadline: string;
};

export type Vote = {
  id: string;
  sessionId: string;
  userId: string;
  date: string;
  choice: VoteChoice;
  comment: string | null;
};

export type Place = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: "FD6" | "CE7" | "SW8";
  rating: number;
  imageUrl: string | null;
};

export type KakaoPlace = {
  kakaoPlaceId: string;
  name: string;
  address: string;
  roadAddress: string;
  latitude: number;
  longitude: number;
  distance: number;
  categoryCode: string;
  phone: string;
};

export type TimeSlot = {
  id: string;
  sessionId: string;
  userId: string;
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
};

export type Memory = {
  id: string;
  groupId: string;
  date: string;
  placeId: string;
  photos: string[];
  note: string | null;
  participants: User[];
};

export type Schedule = {
  id: string;
  userId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  memo: string | null;
  type: "personal" | "group";
};
