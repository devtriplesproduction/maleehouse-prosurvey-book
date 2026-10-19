import workflowConfig from "@/config/workflow_config.json";
import { Role } from "./permissions/roles";

export interface StageConfig {
  display_name: string;
  allowed_roles: string[];
  transitions_to: string[];
  task_generation: string[];
  payment_gate: string | null;
  required_files: string[];
  allow_rollback: boolean;
}

export interface TemplateConfig {
  display_name: string;
  pipeline: string[];
  billing_milestones: string[];
}

export interface WorkflowConfigType {
  stages: Record<string, StageConfig>;
  templates: Record<string, TemplateConfig>;
}

const typedWorkflowConfig = workflowConfig as WorkflowConfigType;

/**
 * Gets all stages defined in the configuration.
 */
export function getStagesRegistry(): Record<string, StageConfig> {
  return typedWorkflowConfig.stages;
}

/**
 * Gets a specific stage configuration.
 */
export function getStageConfig(stage: string): StageConfig | undefined {
  return typedWorkflowConfig.stages[stage];
}

/**
 * Gets all templates defined in the configuration.
 */
export function getTemplatesRegistry(): Record<string, TemplateConfig> {
  return typedWorkflowConfig.templates;
}

/**
 * Gets a specific template configuration.
 */
export function getTemplateConfig(template: string): TemplateConfig | undefined {
  return typedWorkflowConfig.templates[template];
}

/**
 * Validates whether a project can transition from currentStage to targetStage.
 */
export function validateStageTransitionRule(
  currentStage: string,
  targetStage: string,
  userRole: Role,
  context: {
    unpaidMilestones: string[];
    pendingTasks: string[];
    missingFiles: string[];
    workflowType?: string;
  }
): { allowed: boolean; reason?: string } {
  const currentCfg = getStageConfig(currentStage);
  if (!currentCfg) {
    return { allowed: false, reason: `Current stage '${currentStage}' is not recognized in system configuration.` };
  }

  // 1. Check allowed roles (Admins always override)
  if (userRole !== "admin" && !currentCfg.allowed_roles.includes(userRole)) {
    return { allowed: false, reason: `Role '${userRole}' is not authorized to transition the project out of stage '${currentStage}'.` };
  }

  // 2. Check transition pathway
  const targetCfg = getStageConfig(targetStage);
  if (!targetCfg) {
    return { allowed: false, reason: `Target stage '${targetStage}' is not recognized in system configuration.` };
  }

  let isDirectAdvance = false;
  let isRollback = false;

  if (context?.workflowType) {
    const template = getTemplateConfig(context.workflowType);
    if (template && template.pipeline.length > 0) {
      const currentIndex = template.pipeline.indexOf(currentStage);
      const targetIndex = template.pipeline.indexOf(targetStage);
      
      if (targetIndex !== -1 && currentIndex !== -1) {
        isDirectAdvance = targetIndex === currentIndex + 1;
        isRollback = targetIndex < currentIndex;
      }
    }
  }

  if (!isDirectAdvance && !isRollback) {
    const STAGE_ORDER = [
      "lead",
      "lead_created",
      "quotation_requested",
      "quotation_sent",
      "payment_pending",
      "payment_done",
      "ready_for_dispatch",
      "project_created",
      "data_collection",
      "prototype",
      "gis_design",
      "field_assigned",
      "field_work",
      "data_sync",
      "review",
      "final_review",
      "completed",
      "delivered",
      "archived"
    ];
    const currentIndex = STAGE_ORDER.indexOf(currentStage);
    const targetIndex = STAGE_ORDER.indexOf(targetStage);
    if (currentIndex !== -1 && targetIndex !== -1) {
      isRollback = targetIndex < currentIndex;
      isDirectAdvance = currentCfg.transitions_to.includes(targetStage);
    } else {
      isDirectAdvance = currentCfg.transitions_to.includes(targetStage);
      isRollback = targetCfg.transitions_to.includes(currentStage);
    }
  }

  if (!isDirectAdvance && !isRollback) {
    return { allowed: false, reason: `Transition path from '${currentStage}' to '${targetStage}' is not registered.` };
  }

  // If it's a rollback (resuming from an earlier step on new data or correction), bypass forward gate checks
  if (isRollback) {
    return { allowed: true };
  }

  // 3. Check Stage Payment Locks
  if (currentCfg.payment_gate && context.unpaidMilestones.includes(currentCfg.payment_gate)) {
    return { allowed: false, reason: `Blocked: Milestone payment for '${currentCfg.payment_gate}' must be paid and verified.` };
  }

  // 4. Check Required Tasks
  if (context.pendingTasks.length > 0) {
    return { allowed: false, reason: `Prerequisite Tasks Overdue: [${context.pendingTasks.join(", ")}] are incomplete.` };
  }

  // 5. Check Required Files
  if (context.missingFiles.length > 0) {
    return { allowed: false, reason: `Missing Required Deliverables in Vault: [${context.missingFiles.join(", ")}] are missing.` };
  }

  return { allowed: true };
}

/**
 * Returns the list of tasks to generate automatically when entering a stage.
 */
export function getTasksForStage(stage: string): string[] {
  const cfg = getStageConfig(stage);
  return cfg ? cfg.task_generation : [];
}

/**
 * Gets a standardized display name for a project stage.
 */
export function getStageDisplayName(stage: string, workflowType?: string | null): string {
  if (stage === 'prototype') return 'GIS Prototype';
  if (stage === 'gis_design') return 'GIS Design';
  if (stage === 'review') return 'QC Board Review';
  if (stage === 'final_review') return 'Final Deliverable Review';
  if (stage === 'completed') return 'Delivered';
  if (stage === 'data_collection') {
    return workflowType === 'gis_survey_design' ? 'Survey Data Collection' : 'Data Collection';
  }
  
  const cfg = getStageConfig(stage);
  if (cfg && cfg.display_name) return cfg.display_name;
  
  return stage.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/**
 * Computes whether an uploaded file belongs to a prior step in the project workflow pipeline,
 * and returns the earlier target stage to rewind to so work can resume from that step.
 */
export function getRewindStageForCategory(
  currentStage?: string | null,
  category?: string,
  workflowType?: string | null
): { shouldRewind: boolean; targetStage?: string; reason?: string } {
  if (!currentStage || !category) return { shouldRewind: false };

  const STAGE_ORDER = [
    "lead",
    "lead_created",
    "quotation_requested",
    "quotation_sent",
    "payment_pending",
    "payment_done",
    "ready_for_dispatch",
    "project_created",
    "data_collection",
    "prototype",
    "gis_design",
    "field_assigned",
    "field_work",
    "data_sync",
    "review",
    "final_review",
    "completed",
    "delivered",
    "archived"
  ];

  let pipeline: string[] = [];
  if (workflowType) {
    const template = getTemplateConfig(workflowType);
    if (template?.pipeline && template.pipeline.length > 0) {
      pipeline = template.pipeline;
    }
  }

  const currentIndex = pipeline.length > 0
    ? pipeline.indexOf(currentStage)
    : STAGE_ORDER.indexOf(currentStage);

  if (currentIndex === -1) return { shouldRewind: false };

  let targetStage: string | null = null;
  let reason: string = "";

  if (['survey_data', 'control_point_csv', 'control_point_image', 'site_photo'].includes(category)) {
    targetStage = 'data_collection';
    reason = `New field survey data uploaded. Workflow rewound to data collection.`;
  } else if (['requirements', 'intake_document', 'client_doc'].includes(category)) {
    targetStage = 'data_collection';
    reason = `New client requirements uploaded. Workflow rewound to data collection.`;
  } else if (['prototype', 'cad_drawing', 'cad_file'].includes(category)) {
    if (pipeline.includes('prototype')) {
      targetStage = 'prototype';
    } else if (pipeline.includes('gis_design')) {
      targetStage = 'gis_design';
    } else if (pipeline.includes('data_sync')) {
      targetStage = 'data_sync';
    } else {
      targetStage = 'data_collection';
    }
    reason = `New design deliverable uploaded. Workflow rewound to ${targetStage}.`;
  } else if (['final_file'].includes(category)) {
    if (['completed', 'delivered', 'archived'].includes(currentStage)) {
      if (pipeline.includes('final_review')) {
        targetStage = 'final_review';
      } else if (pipeline.includes('review')) {
        targetStage = 'review';
      } else if (pipeline.includes('data_sync')) {
        targetStage = 'data_sync';
      } else {
        targetStage = 'data_collection';
      }
      reason = `New final deliverable uploaded to closed project. Project reopened for review.`;
    }
  }

  if (!targetStage) return { shouldRewind: false };

  const targetIndex = pipeline.length > 0
    ? pipeline.indexOf(targetStage)
    : STAGE_ORDER.indexOf(targetStage);

  if (targetIndex !== -1 && targetIndex < currentIndex) {
    return { shouldRewind: true, targetStage, reason };
  }

  return { shouldRewind: false };
}

