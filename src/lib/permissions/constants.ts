import { Role } from "./roles";

// Centralized permission checks for different operations
export const PERMISSIONS = {
  // Project Permissions
  PROJECT_CREATE: ["admin", "sales"],
  PROJECT_DELETE: ["admin"],
  PROJECT_ARCHIVE: ["admin", "accountant"],

  // Pipeline/Global View Permissions
  VIEW_SALES_PIPELINE: ["admin", "sales"],
  VIEW_ACCOUNTS_PIPELINE: ["admin", "accountant", "sales"],
  VIEW_ALL_PROJECTS: ["admin", "accountant", "engineer"], // Roles that can see all projects without assignment

  // Workflow Stages Configuration
  STAGE_UPDATE: {
    admin: ["*", "final_review"],
    sales: ["lead_created", "payment_pending"],
    accountant: ["payment_pending", "payment_done", "ready_for_dispatch", "project_created"],
    engineer: [
      "data_collection", "field_work", "data_sync",
      "field_assigned", "review", "payment_pending", "completed", "final_review"
    ],
    field: ["data_collection", "field_work", "field_assigned", "field_in_progress", "field_completed", "data_sync"],
    hr: [],
    developer: [],
  } as Record<Role, string[]>,

  // File Upload Categories
  FILE_UPLOAD: {
    admin: ["*"],
    sales: ["requirements"],
    accountant: ["receipt"],
    engineer: ["requirements", "survey_data", "final_file", "technical_doc"],
    field: ["survey_data", "site_photo", "field_report"],
    hr: [],
    developer: [],
  } as Record<Role, string[]>
};
