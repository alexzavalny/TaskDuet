export type PeriodType = "day" | "week" | "month";

export interface Database {
  public: {
    Tables: {
      pair_members: {
        Row: {
          id: string;
          joined_at: string;
          pair_id: string;
          profile_id: string;
          role: string;
          slot: string | null;
        };
        Insert: {
          id?: string;
          joined_at?: string;
          pair_id: string;
          profile_id: string;
          role?: string;
          slot?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["pair_members"]["Insert"]>;
      };
      pairs: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pairs"]["Insert"]>;
      };
      profiles: {
        Row: {
          active_pair_id: string | null;
          created_at: string;
          display_name: string;
          id: string;
          invite_code: string;
          updated_at: string;
        };
        Insert: {
          active_pair_id?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          invite_code: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      tasks: {
        Row: {
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          id: string;
          owner_profile_id: string;
          pair_id: string;
          period_anchor_date: string;
          period_type: PeriodType;
          title: string;
          updated_at: string;
        };
        Insert: {
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          owner_profile_id: string;
          pair_id: string;
          period_anchor_date: string;
          period_type: PeriodType;
          title: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_pair_with_invite: {
        Args: {
          invite_code_input: string;
        };
        Returns: string;
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Pair = Database["public"]["Tables"]["pairs"]["Row"];
export type PairMember = Database["public"]["Tables"]["pair_members"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
