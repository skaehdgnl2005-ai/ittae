// Auto-generated from DATA_MODEL.md — do not edit directly.
// Re-generate with: pnpm db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          nickname: string;
          profile_image_url: string | null;
          status_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          nickname: string;
          profile_image_url?: string | null;
          status_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          nickname?: string;
          profile_image_url?: string | null;
          status_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          receiver_id: string;
          status: "pending" | "accepted";
          created_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          receiver_id: string;
          status?: "pending" | "accepted";
          created_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          receiver_id?: string;
          status?: "pending" | "accepted";
          created_at?: string;
        };
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          host_id: string;
          status: "voting" | "confirmed" | "completed";
          confirmed_date: string | null;
          place_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          host_id: string;
          status?: "voting" | "confirmed" | "completed";
          confirmed_date?: string | null;
          place_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          host_id?: string;
          status?: "voting" | "confirmed" | "completed";
          confirmed_date?: string | null;
          place_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          group_id?: string;
          user_id?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
      vote_sessions: {
        Row: {
          id: string;
          group_id: string;
          candidate_dates: string[];
          deadline: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          candidate_dates: string[];
          deadline?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          candidate_dates?: string[];
          deadline?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      votes: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          date: string;
          choice: "available" | "maybe" | "unavailable";
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          date: string;
          choice: "available" | "maybe" | "unavailable";
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          date?: string;
          choice?: "available" | "maybe" | "unavailable";
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      places: {
        Row: {
          id: string;
          kakao_place_id: string | null;
          name: string;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          category: string | null;
          rating: number | null;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          kakao_place_id?: string | null;
          name: string;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          category?: string | null;
          rating?: number | null;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          kakao_place_id?: string | null;
          name?: string;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          category?: string | null;
          rating?: number | null;
          image_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      memories: {
        Row: {
          id: string;
          group_id: string;
          date: string;
          place_id: string | null;
          photos: string[];
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          date: string;
          place_id?: string | null;
          photos?: string[];
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          date?: string;
          place_id?: string | null;
          photos?: string[];
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      schedules: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          date: string;
          start_time: string | null;
          end_time: string | null;
          memo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          date: string;
          start_time?: string | null;
          end_time?: string | null;
          memo?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          date?: string;
          start_time?: string | null;
          end_time?: string | null;
          memo?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
