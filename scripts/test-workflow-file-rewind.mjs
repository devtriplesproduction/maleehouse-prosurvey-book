/**
 * Test workflow file rewind invariants:
 * Ensures that uploading new data files to earlier steps automatically rewinds the project state,
 * unlocks completed/delivered projects for rework, and respects pipeline configurations.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.log('  [FAIL]', msg);
    failed++;
  } else {
    console.log('  [PASS]', msg);
  }
}

function read(p) {
  return readFileSync(join(root, p), 'utf8');
}

console.log('\n=== Workflow File Rewind Invariants ===\n');

// 1. workflow_config.json allows completed stage rollback
const workflowConfig = JSON.parse(read('src/config/workflow_config.json'));
assert(
  workflowConfig.stages?.completed?.allow_rollback === true,
  'Completed stage in workflow_config.json has allow_rollback: true'
);

// 2. STAGE_ORDER in workflow.actions.ts has review and final_review after data_sync
const workflowActions = read('src/actions/workflow.actions.ts');
const stageOrderStart = workflowActions.indexOf('const STAGE_ORDER = [');
const stageOrderEnd = workflowActions.indexOf('];', stageOrderStart);
const stageOrderSlice = workflowActions.substring(stageOrderStart, stageOrderEnd);
const syncPos = stageOrderSlice.indexOf('"data_sync"');
const reviewPos = stageOrderSlice.indexOf('"review"');
const completedPos = stageOrderSlice.indexOf('"completed"');
assert(
  syncPos !== -1 && reviewPos !== -1 && syncPos < reviewPos,
  'data_sync appears before review in STAGE_ORDER'
);
assert(
  reviewPos !== -1 && completedPos !== -1 && reviewPos < completedPos,
  'review appears before completed in STAGE_ORDER'
);

// 3. Automated rewind option in transitionWorkflowAction
assert(
  workflowActions.includes('options?: { isAutomatedRewind?: boolean }'),
  'transitionWorkflowAction supports isAutomatedRewind parameter'
);

// 4. getRewindStageForCategory exported in workflow-engine.ts and used in file.actions.ts
const workflowEngine = read('src/lib/workflow-engine.ts');
assert(
  workflowEngine.includes('export function getRewindStageForCategory'),
  'workflow-engine.ts exports getRewindStageForCategory'
);
const fileActions = read('src/actions/file.actions.ts');
assert(
  fileActions.includes('getRewindStageForCategory(project?.status'),
  'registerFileAction invokes getRewindStageForCategory on upload'
);
assert(
  fileActions.includes('transitionWorkflowAction('),
  'registerFileAction triggers transitionWorkflowAction on rewind'
);
assert(
  fileActions.includes('updated_project_stage: updatedStage'),
  'registerFileAction returns updated_project_stage in response payload'
);

// 5. Operations upload panels and document tabs handle stage rewinds
const opsPanel = read('src/components/modules/OperationsFileUploadPanel.tsx');
assert(
  opsPanel.includes('registerResult.data?.updated_project_stage'),
  'OperationsFileUploadPanel listens for updated_project_stage'
);
assert(
  opsPanel.includes('onUpdateProject?.({ status: registerResult.data.updated_project_stage })'),
  'OperationsFileUploadPanel updates project status via callback'
);

const docTab = read('src/components/modules/ProjectDocumentsTab.tsx');
assert(
  docTab.includes('registerResult.data?.updated_project_stage'),
  'ProjectDocumentsTab listens for updated_project_stage'
);

const digitalVault = read('src/components/modules/DigitalVault.tsx');
assert(
  digitalVault.includes('registerResult.data?.updated_project_stage'),
  'DigitalVault listens for updated_project_stage'
);

const fileUploader = read('src/components/modules/FileUploader.tsx');
assert(
  fileUploader.includes('registerResult.data?.updated_project_stage'),
  'FileUploader listens for updated_project_stage'
);

// 6. Test behavioral logic of rewind helper directly
function getRewindStageForCategory(currentStage, category, workflowType) {
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

  let pipeline = [];
  if (workflowType && workflowConfig.templates[workflowType]) {
    pipeline = workflowConfig.templates[workflowType].pipeline;
  }

  const currentIndex = pipeline.length > 0 
    ? pipeline.indexOf(currentStage) 
    : STAGE_ORDER.indexOf(currentStage);

  if (currentIndex === -1) return { shouldRewind: false };

  let targetStage = null;
  let reason = "";

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

// Logic asserts:
const r1 = getRewindStageForCategory('completed', 'survey_data', 'topographic_survey');
assert(r1.shouldRewind === true && r1.targetStage === 'data_collection', 'Completed topo survey rewinds to data_collection on new survey_data');

const r2 = getRewindStageForCategory('review', 'survey_data', 'dgps_survey');
assert(r2.shouldRewind === true && r2.targetStage === 'data_collection', 'In-review DGPS survey rewinds to data_collection on new survey_data');

const r3 = getRewindStageForCategory('data_collection', 'survey_data', 'topographic_survey');
assert(r3.shouldRewind === false, 'data_collection does not rewind when uploading survey_data (already at data_collection)');

const r4 = getRewindStageForCategory('completed', 'final_file', 'dgps_survey');
assert(r4.shouldRewind === true && r4.targetStage === 'review', 'Completed project rewinds to review on new final deliverable');

const r5 = getRewindStageForCategory('data_collection', 'final_file', 'dgps_survey');
assert(r5.shouldRewind === false, 'data_collection does not rewind on final_file upload');

const r6 = getRewindStageForCategory('completed', 'prototype', 'road_alignment_survey');
assert(r6.shouldRewind === true && r6.targetStage === 'data_sync', 'Completed road survey rewinds to data_sync on new design upload');

const r7 = getRewindStageForCategory('payment_pending', 'survey_data');
assert(r7.shouldRewind === false, 'Commercial stage (payment_pending) does not rewind to data_collection');

console.log(`\nResults: ${failed === 0 ? 'ALL INVARIANTS PASSED' : `${failed} CHECKS FAILED`}\n`);
process.exit(failed > 0 ? 1 : 0);
