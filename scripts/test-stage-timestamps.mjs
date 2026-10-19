import assert from 'assert';

const WORKFLOW_STAGES = [
  { id: 1, label: 'Project Created', statusKey: 'project_created' },
  { id: 2, label: 'Data Collection', statusKey: 'data_collection' },
  { id: 3, label: 'Field Team Assignment', statusKey: 'field_assigned' },
  { id: 4, label: 'Survey Collection', statusKey: 'field_work' },
  { id: 5, label: 'Survey Validation', statusKey: 'data_sync' },
  { id: 6, label: 'Final Deliverable', statusKey: 'final_review' },
  { id: 7, label: 'Delivered', statusKey: 'completed' }
];

function getStageTimestamp(stage, idx, currentIndex, history, activityLogs, projectCreatedAt, projectUpdatedAt) {
  if (idx > currentIndex) return null;

  if (idx === 0 || stage.statusKey === 'project_created') {
    let match = history.find(h => 
      h.to_stage === stage.statusKey || 
      h.to_stage === 'payment_pending' || 
      h.to_stage === 'lead_created' || 
      h.to_stage === 'ready_for_dispatch'
    );
    if (!match && (activityLogs || []).length > 0) {
      match = activityLogs.find(l => l.action === 'PROJECT_CREATED' || l.details?.to_stage === stage.statusKey);
    }
    if (!match && history.length > 0) {
      match = history[history.length - 1];
    }
    const raw = match?.created_at || projectCreatedAt;
    return raw ? new Date(raw) : null;
  }

  let match = history.find(h => 
    h.to_stage === stage.statusKey || 
    h.new_status === stage.statusKey || 
    h.to_status === stage.statusKey
  );

  if (!match && (activityLogs || []).length > 0) {
    match = activityLogs.find(l => 
      l.details?.to_stage === stage.statusKey || 
      l.details?.new_status === stage.statusKey ||
      l.stage === stage.statusKey
    );
  }

  const isCompleted = idx < currentIndex;
  if (!match && isCompleted) {
    match = history.find(h => h.from_stage === stage.statusKey);
    if (!match) {
      for (let nextIdx = idx + 1; nextIdx <= currentIndex; nextIdx++) {
        const nextKey = WORKFLOW_STAGES[nextIdx]?.statusKey;
        const nextMatch = history.find(h => 
          h.to_stage === nextKey || 
          h.new_status === nextKey || 
          h.to_status === nextKey
        );
        if (nextMatch) {
          match = nextMatch;
          break;
        }
      }
    }
  }

  const isActive = idx === currentIndex;
  if (!match && isActive) {
    const raw = projectUpdatedAt || projectCreatedAt;
    return raw ? new Date(raw) : null;
  }

  return match?.created_at ? new Date(match.created_at) : null;
}

// Test Case 1: Initial project created in payment_pending
const history1 = [
  { id: '1', to_stage: 'payment_pending', created_at: '2026-10-17T12:00:57.401Z' }
];
const date1 = getStageTimestamp(WORKFLOW_STAGES[0], 0, 0, history1, [], '2026-10-17T12:00:55.000Z', null);
assert(date1 instanceof Date, 'Stage 0 must resolve a valid date');
assert.strictEqual(date1.toISOString(), '2026-10-17T12:00:57.401Z');

// Test Case 2: Pending stage returns null
const pendingDate = getStageTimestamp(WORKFLOW_STAGES[1], 1, 0, history1, [], '2026-10-17T12:00:55.000Z', null);
assert.strictEqual(pendingDate, null, 'Pending stage must return null');

// Test Case 3: Transitioned stage
const history2 = [
  { id: '2', from_stage: 'project_created', to_stage: 'data_collection', created_at: '2026-10-18T09:00:00.000Z' },
  { id: '1', to_stage: 'payment_pending', created_at: '2026-10-17T12:00:57.401Z' }
];
const date2 = getStageTimestamp(WORKFLOW_STAGES[1], 1, 1, history2, [], null, null);
assert(date2 instanceof Date, 'Active stage with transition log must resolve valid date');
assert.strictEqual(date2.toISOString(), '2026-10-18T09:00:00.000Z');

// Test Case 4: Completed stage 0 with stage 1 active
const date0Completed = getStageTimestamp(WORKFLOW_STAGES[0], 0, 1, history2, [], null, null);
assert(date0Completed instanceof Date, 'Completed stage 0 must resolve creation timestamp');
assert.strictEqual(date0Completed.toISOString(), '2026-10-17T12:00:57.401Z');

console.log('✅ All stage timestamp self-checks passed successfully.');
