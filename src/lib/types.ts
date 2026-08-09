export type Property = {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: string;
  beds: number;
  baths: number;
  sqft: number;
  rent: number;
  deposit: number;
  status: "vacant" | "occupied";
  listed: number;
  priority_listing: number;
  description: string;
  amenities: string;
  /** "whole" = rent the entire place; "by_room" = rent each room separately. */
  rental_type: "whole" | "by_room";
  created_at: string;
  room_count?: number;
  rooms_vacant?: number;
};

/** A room inside a property, when renting by the room. */
export type Unit = {
  id: number;
  property_id: number;
  name: string;
  rent: number;
  deposit: number;
  status: "vacant" | "occupied";
  size_sqft: number;
  private_bath: number;
  furnished: number;
  listed: number;
  description: string;
  created_at: string;
  property_name?: string;
  property_city?: string;
  property_state?: string;
  property_address?: string;
  property_amenities?: string;
  tenant_names?: string;
};

export type Person = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  stage: "lead" | "applicant" | "tenant" | "past";
  property_id: number | null;
  unit_id: number | null;
  notes: string;
  portal_token: string;
  created_at: string;
  property_name?: string;
  unit_name?: string;
};

export type CustomQuestion = {
  id: number;
  question: string;
  type: "text" | "yesno" | "number";
  required: number;
  archived: number;
};

export type Application = {
  id: number;
  person_id: number;
  property_id: number | null;
  unit_id: number | null;
  status: "pending" | "screening" | "approved" | "denied";
  monthly_income: number;
  employer: string;
  income_verified: number;
  screening_status: "not_requested" | "requested" | "completed";
  screening_notes: string;
  screening_link: string;
  answers: string;
  move_in_date: string;
  created_at: string;
  applicant_name?: string;
  applicant_email?: string;
  property_name?: string;
  property_rent?: number;
  unit_name?: string;
  unit_rent?: number;
};

export type Lease = {
  id: number;
  property_id: number;
  unit_id: number | null;
  start_date: string;
  end_date: string;
  rent: number;
  deposit: number;
  status: "draft" | "sent" | "signed" | "active" | "ended";
  esign_provider: string;
  esign_url: string;
  notes: string;
  created_at: string;
  property_name?: string;
  unit_name?: string;
  tenant_names?: string;
};

export type Payment = {
  id: number;
  lease_id: number | null;
  person_id: number | null;
  amount: number;
  type: "rent" | "deposit" | "late_fee" | "utility" | "other";
  due_date: string;
  paid_date: string | null;
  method: string;
  status: "unpaid" | "reported" | "paid";
  notes: string;
  reported_method: string;
  reported_date: string;
  reported_note: string;
  created_at: string;
  tenant_name?: string;
  property_name?: string;
};

export type MaintenanceRequest = {
  id: number;
  property_id: number;
  person_id: number | null;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "new" | "in_progress" | "completed" | "cancelled";
  created_at: string;
  completed_at: string | null;
  property_name?: string;
  tenant_name?: string;
};

export type Txn = {
  id: number;
  property_id: number | null;
  date: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  description: string;
  payment_id: number | null;
  created_at: string;
  property_name?: string;
};

export type Doc = {
  id: number;
  name: string;
  type: string;
  lease_id: number | null;
  property_id: number | null;
  status: "draft" | "sent" | "viewed" | "signed";
  provider: string;
  external_url: string;
  created_at: string;
  signed_at: string | null;
  property_name?: string;
};

export type ConditionReport = {
  id: number;
  property_id: number;
  lease_id: number | null;
  type: "move_in" | "move_out";
  status: "draft" | "sent" | "completed";
  items: string;
  notes: string;
  created_at: string;
  completed_at: string | null;
  property_name?: string;
};

export type BankAccount = {
  id: number;
  name: string;
  institution: string;
  last4: string;
  kind: "bank" | "zelle" | "cashapp" | "venmo" | "paypal" | "other";
  property_id: number | null;
  notes: string;
  created_at: string;
  property_name?: string;
};

export type BankImport = {
  id: number;
  account_id: number | null;
  posted_date: string;
  description: string;
  amount: number;
  source: string;
  status: "unmatched" | "matched" | "ignored";
  payment_id: number | null;
  person_id: number | null;
  fingerprint: string;
  created_at: string;
  account_name?: string;
  matched_tenant?: string;
};

export type ConditionItem = {
  area: string;
  condition: "good" | "fair" | "poor" | "";
  notes: string;
};
