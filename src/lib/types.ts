/**
 * Application types.
 *
 * Records live in PocketBase, so ids and relations are strings. Fields ending
 * in `_name` / `_names` are resolved in the data layer for display and are not
 * stored on the record itself.
 */

export type Id = string;

export type Property = {
  id: Id;
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
  listed: boolean;
  priority_listing: boolean;
  description: string;
  amenities: string;
  /** "whole" = rent the entire place; "by_room" = rent each room separately. */
  rental_type: "whole" | "by_room";
  archived: boolean;
  created: string;
  room_count?: number;
  rooms_vacant?: number;
};

/** A room inside a property, when renting by the room. */
export type Unit = {
  id: Id;
  property: Id;
  name: string;
  rent: number;
  deposit: number;
  status: "vacant" | "occupied";
  size_sqft: number;
  private_bath: boolean;
  furnished: boolean;
  listed: boolean;
  description: string;
  created: string;
  property_name?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_amenities?: string;
  tenant_names?: string;
};

export type Person = {
  id: Id;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  stage: "lead" | "applicant" | "tenant" | "past";
  property: Id | "";
  unit: Id | "";
  notes: string;
  portal_token: string;
  archived: boolean;
  created: string;
  property_name?: string;
  unit_name?: string;
};

export type CustomQuestion = {
  id: Id;
  question: string;
  type: "text" | "yesno" | "number";
  required: boolean;
  archived: boolean;
};

export type Answer = { question: string; answer: string };

export type Application = {
  id: Id;
  person: Id;
  property: Id | "";
  unit: Id | "";
  status: "pending" | "screening" | "approved" | "denied";
  monthly_income: number;
  employer: string;
  income_verified: boolean;
  screening_status: "not_requested" | "requested" | "completed";
  screening_notes: string;
  screening_link: string;
  answers: Answer[];
  move_in_date: string;
  created: string;
  applicant_name?: string;
  applicant_email?: string;
  property_name?: string;
  property_rent?: number;
  unit_name?: string;
  unit_rent?: number;
};

export type Lease = {
  id: Id;
  property: Id;
  unit: Id | "";
  tenants: Id[];
  start_date: string;
  end_date: string;
  rent: number;
  deposit: number;
  status: "draft" | "sent" | "signed" | "active" | "ended";
  esign_provider: string;
  esign_url: string;
  esign_document_id: string;
  notes: string;
  created: string;
  property_name?: string;
  unit_name?: string;
  tenant_names?: string;
};

export type Payment = {
  id: Id;
  lease: Id | "";
  person: Id | "";
  amount: number;
  type: "rent" | "deposit" | "late_fee" | "utility" | "other";
  due_date: string;
  paid_date: string;
  method: string;
  status: "unpaid" | "reported" | "paid";
  notes: string;
  reported_method: string;
  reported_date: string;
  reported_note: string;
  created: string;
  tenant_name?: string;
  property_name?: string;
};

export type MaintenanceRequest = {
  id: Id;
  property: Id;
  unit: Id | "";
  person: Id | "";
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "new" | "in_progress" | "completed" | "cancelled";
  completed_at: string;
  created: string;
  property_name?: string;
  tenant_name?: string;
};

export type Txn = {
  id: Id;
  property: Id | "";
  date: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  description: string;
  payment: Id | "";
  bank_import: Id | "";
  created: string;
  property_name?: string;
};

export type Doc = {
  id: Id;
  name: string;
  type: string;
  lease: Id | "";
  property: Id | "";
  status: "draft" | "sent" | "viewed" | "signed";
  provider: string;
  external_url: string;
  signed_at: string;
  created: string;
  property_name?: string;
};

/**
 * One signer's request and, once they sign, the evidence that they did.
 *
 * The fields after `status` are what makes an electronic signature hold up:
 * the signer's own words for their name, the consent they agreed to, when and
 * from where, and a hash of the exact document they were shown.
 */
export type Signature = {
  id: Id;
  lease: Id;
  person: Id | "";
  role: "landlord" | "tenant";
  signer_name: string;
  signer_email: string;
  token: string;
  status: "pending" | "signed" | "declined" | "cancelled";
  typed_name: string;
  drawn_signature: string;
  consent_text: string;
  document_hash: string;
  ip: string;
  user_agent: string;
  sent_at: string;
  signed_at: string;
  decline_reason: string;
  created: string;
};

export type ConditionItem = {
  area: string;
  condition: "good" | "fair" | "poor" | "";
  notes: string;
};

export type ConditionReport = {
  id: Id;
  property: Id;
  lease: Id | "";
  type: "move_in" | "move_out";
  status: "draft" | "sent" | "completed";
  items: ConditionItem[];
  notes: string;
  completed_at: string;
  created: string;
  property_name?: string;
};

export type BankAccount = {
  id: Id;
  name: string;
  institution: string;
  last4: string;
  kind: "bank" | "zelle" | "cashapp" | "venmo" | "paypal" | "other";
  property: Id | "";
  notes: string;
  /** What the account held on `balance_date` — the app carries it forward. */
  opening_balance: number;
  balance_date: string;
  created: string;
  property_name?: string;
};

export type BankImport = {
  id: Id;
  account: Id | "";
  posted_date: string;
  description: string;
  amount: number;
  source: string;
  /**
   * `already_recorded` is a question waiting on the landlord — it looks like
   * money already on the books. `expense_review` is a withdrawal waiting to be
   * categorised; `expense_booked` once it has been.
   */
  status:
    | "unmatched"
    | "matched"
    | "ignored"
    | "already_recorded"
    | "expense_review"
    | "expense_booked";
  payment: Id | "";
  person: Id | "";
  fingerprint: string;
  hidden: boolean;
  created: string;
  account_name?: string;
  matched_tenant?: string;
  /** When the payment we think this duplicates was recorded. */
  matched_payment_date?: string;
};
