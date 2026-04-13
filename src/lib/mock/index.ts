import type { User, Group, VoteSession, Vote, Place, Memory, Schedule } from "@/types";

export const mockCurrentUserId = "u5";

export const mockUsers: User[] = [
  { id: "u1", nickname: "김민준", profileImageUrl: null, statusMessage: "오늘도 화이팅" },
  { id: "u2", nickname: "이서연", profileImageUrl: null, statusMessage: null },
  { id: "u3", nickname: "박지호", profileImageUrl: null, statusMessage: "바쁜 하루" },
  { id: "u4", nickname: "최유나", profileImageUrl: null, statusMessage: null },
  { id: "u5", nickname: "나", profileImageUrl: null, statusMessage: "모임 앱 테스트 중" },
];

export const mockGroups: Group[] = [
  {
    id: "g1",
    name: "대학 동기 모임",
    hostId: "u5",
    status: "voting",
    confirmedDate: null,
    placeId: null,
    createdAt: "2026-04-10T10:00:00Z",
    members: [mockUsers[0], mockUsers[1], mockUsers[2], mockUsers[4]],
  },
  {
    id: "g2",
    name: "회사 팀 회식",
    hostId: "u1",
    status: "confirmed",
    confirmedDate: "2026-04-20",
    placeId: "p1",
    createdAt: "2026-04-05T09:00:00Z",
    members: [mockUsers[0], mockUsers[3], mockUsers[4]],
  },
  {
    id: "g3",
    name: "고등학교 친구들",
    hostId: "u2",
    status: "completed",
    confirmedDate: "2026-03-28",
    placeId: "p2",
    createdAt: "2026-03-20T11:00:00Z",
    members: [mockUsers[1], mockUsers[2], mockUsers[3], mockUsers[4]],
  },
];

export const mockVoteSession: VoteSession = {
  id: "vs1",
  groupId: "g1",
  candidateDates: ["2026-04-25", "2026-04-26", "2026-04-27"],
  deadline: "2026-04-20",
};

export const mockVotes: Vote[] = [
  { id: "v1", sessionId: "vs1", userId: "u1", date: "2026-04-25", choice: "available", comment: null },
  { id: "v2", sessionId: "vs1", userId: "u1", date: "2026-04-26", choice: "maybe", comment: "오후만 가능해요" },
  { id: "v3", sessionId: "vs1", userId: "u1", date: "2026-04-27", choice: "unavailable", comment: null },
  { id: "v4", sessionId: "vs1", userId: "u2", date: "2026-04-25", choice: "available", comment: null },
  { id: "v5", sessionId: "vs1", userId: "u2", date: "2026-04-26", choice: "available", comment: null },
  { id: "v6", sessionId: "vs1", userId: "u2", date: "2026-04-27", choice: "maybe", comment: null },
  { id: "v7", sessionId: "vs1", userId: "u3", date: "2026-04-25", choice: "available", comment: null },
  { id: "v8", sessionId: "vs1", userId: "u3", date: "2026-04-26", choice: "unavailable", comment: "선약 있어요" },
  { id: "v9", sessionId: "vs1", userId: "u3", date: "2026-04-27", choice: "unavailable", comment: null },
];

export const mockPlaces: Place[] = [
  { id: "p1", name: "강남 코너스톤", address: "서울 강남구 역삼동 123", latitude: 37.499, longitude: 127.026, category: "FD6", rating: 4.5, imageUrl: null },
  { id: "p2", name: "홍대 라운지", address: "서울 마포구 동교동 45", latitude: 37.552, longitude: 126.922, category: "CE7", rating: 4.2, imageUrl: null },
  { id: "p3", name: "이태원 비스트로", address: "서울 용산구 이태원동 78", latitude: 37.534, longitude: 126.994, category: "FD6", rating: 4.7, imageUrl: null },
];

export const mockMemories: Memory[] = [
  {
    id: "m1",
    groupId: "g3",
    date: "2026-03-28",
    placeId: "p2",
    photos: [],
    note: "오랜만에 모여서 너무 즐거웠다",
    participants: [mockUsers[1], mockUsers[2], mockUsers[3], mockUsers[4]],
  },
  {
    id: "m2",
    groupId: "g2",
    date: "2026-02-14",
    placeId: "p1",
    photos: [],
    note: null,
    participants: [mockUsers[0], mockUsers[3], mockUsers[4]],
  },
];

export const mockSchedules: Schedule[] = [
  { id: "s1", userId: "u5", title: "치과 예약", date: "2026-04-13", startTime: "14:00", endTime: "15:00", memo: null, type: "personal" },
  { id: "s2", userId: "u5", title: "분기 리뷰 미팅", date: "2026-04-15", startTime: "10:00", endTime: "11:30", memo: "회의실 A", type: "personal" },
  { id: "s3", userId: "u5", title: "회사 팀 회식", date: "2026-04-20", startTime: "18:00", endTime: "21:00", memo: null, type: "group" },
];
