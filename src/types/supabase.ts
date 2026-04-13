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
      };
      places: {
        Row: {
          id: string;
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
          name?: string;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          category?: string | null;
          rating?: number | null;
          image_url?: string | null;
          created_at?: string;
        };
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
      };
    };
    Enums: Record<string, never>;
  };
};
