export type LegalStatus =
  | "draft_counsel_review_required"
  | "approved_for_publication"
  | "published"
  | "executed_external_evidence_required"
  | "superseded";

export type LegalDocument = {
  id: string;
  title: string;
  type: string;
  purpose: string;
  product_scope: string[];
  owner: string;
  status: LegalStatus;
  version: string;
  version_introduced_at: string;
  effective_at: string | null;
  supersedes_document_id: string | null;
  published_route: string | null;
  template_path: string;
  review_id: string;
  approval_evidence_ref: string | null;
  external_evidence_ref: string | null;
  counsel_review_required: boolean;
  contains_counsel_required_placeholders: boolean;
  customer_specific: boolean;
  tenant_scope_required: boolean;
  allowed_release_targets: string[];
  blocked_release_targets_without_external_review: string[];
  notes: string;
  content_hash: string;
};

export type LegalClause = {
  id: string;
  text: string;
  support_status:
    | "implemented"
    | "documented_limitation"
    | "blocked_pending_counsel"
    | "draft_only";
  control_refs: string[];
  prohibited_without_review: boolean;
};

export type LegalReview = {
  id: string;
  area: string;
  status: "not_started" | "requested" | "completed_external_evidence";
  requested_at: string | null;
  completed_at: string | null;
  qualified_reviewer_ref: string | null;
  external_evidence_ref: string | null;
  conclusions_stored_in_git: boolean;
  blockers: string[];
};

export type ValidationMessage = { level: "pass" | "warn" | "block"; code: string; message: string };
export type ValidationSummary = {
  command: string;
  status: "pass" | "fail";
  messages: ValidationMessage[];
};
