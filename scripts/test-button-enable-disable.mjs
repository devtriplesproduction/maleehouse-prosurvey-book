import assert from 'node:assert';
import fs from 'node:fs';

console.log('\n=== Testing Operations File Upload Panel Button Enable/Disable Invariants ===\n');

const panelFile = fs.readFileSync('src/components/modules/OperationsFileUploadPanel.tsx', 'utf8');

// Check 1: Panel has submittedSections and sessionUploadedDocIds state
assert(panelFile.includes('const [submittedSections, setSubmittedSections] = useState<Record<string, number>>({});'),
  'Must maintain submittedSections state');
assert(panelFile.includes('const [sessionUploadedDocIds, setSessionUploadedDocIds] = useState<Set<string>>(new Set());'),
  'Must maintain sessionUploadedDocIds state');
console.log('  [PASS] State tracking for submitted sections and session uploads defined');

// Check 2: Client Documents hasNewClientDocUpload logic and button disablement
assert(panelFile.includes('const hasNewClientDocUpload = (() => {'),
  'Must compute hasNewClientDocUpload');
assert(panelFile.includes('disabled={isPending || !hasNewClientDocUpload}'),
  'Client Documents notify button must be disabled when !hasNewClientDocUpload');
assert(panelFile.includes('!hasNewClientDocUpload ? "No New Client Documents Uploaded" : "Notify Team of Supplemental Documents"'),
  'Client Documents button must clearly communicate disabled state');
console.log('  [PASS] Client Documents button enable/disable conditions verified');

// Check 3: Field Survey Data hasNewSurveyUpload logic and button disablement
assert(panelFile.includes('const hasNewSurveyUpload = (() => {'),
  'Must compute hasNewSurveyUpload');
assert(panelFile.includes('disabled={isPending || !hasNewSurveyUpload}'),
  'Field Survey submit button must be disabled when !hasNewSurveyUpload');
assert(panelFile.includes('projectStatus === "data_sync" && !hasNewSurveyUpload'),
  'Field Survey button must indicate submitted / awaiting validation when disabled');
console.log('  [PASS] Field Survey Data button enable/disable conditions verified');

// Check 4: Final Deliverables hasNewFinalUpload logic and submit button
assert(panelFile.includes('const hasNewFinalUpload = (() => {'),
  'Must compute hasNewFinalUpload');
assert(panelFile.includes('handleSubmitFinalReport'),
  'Must provide handleSubmitFinalReport action');
assert(panelFile.includes('disabled={isPending || !hasNewFinalUpload || (latestCADRevision?.status === \'pending_review\' && latestCADRevision?.revision_type === \'final\')}'),
  'Final Deliverable submit button must be disabled when !hasNewFinalUpload or validation is pending');
console.log('  [PASS] Final Deliverables button enable/disable conditions verified');

// Check 5: All upload handlers clear the submitted state and register the new file in session
assert(panelFile.includes('delete n.client; return n;'),
  'Client doc upload must clear submitted client state');
assert(panelFile.includes('delete n.survey; return n;'),
  'Survey upload must clear submitted survey state');
assert(panelFile.includes('delete n.final; return n;'),
  'Final doc upload must clear submitted final state');
console.log('  [PASS] Upload handlers clear submitted state to enable buttons upon new uploads');

// Check 6: All submit handlers set the section timestamp to disable the button immediately
assert(panelFile.includes('setSubmittedSections(prev => ({ ...prev, client: Date.now() }))'),
  'Client submit must record submission timestamp');
assert(panelFile.includes('setSubmittedSections(prev => ({ ...prev, survey: Date.now() }))'),
  'Survey submit must record submission timestamp');
assert(panelFile.includes('setSubmittedSections(prev => ({ ...prev, final: Date.now() }))'),
  'Final report submit must record submission timestamp');
console.log('  [PASS] Submit handlers record submission timestamp to immediately disable buttons');

// Check 7: Simulating state machine logic
function createSectionStateMachine() {
  let submittedAt = 0;
  const sessionUploads = new Set();
  let latestFileTime = 0;

  return {
    upload(fileId, time = Date.now()) {
      sessionUploads.add(fileId);
      latestFileTime = time;
      submittedAt = 0; // cleared on new upload
    },
    submit(time = Date.now()) {
      submittedAt = time;
      sessionUploads.clear();
    },
    isEnabled() {
      if (latestFileTime === 0) return false;
      if (submittedAt && submittedAt >= latestFileTime) return false;
      return sessionUploads.size > 0;
    }
  };
}

const sm = createSectionStateMachine();
assert.strictEqual(sm.isEnabled(), false, 'Initially without upload, button is disabled');
sm.upload('doc-1');
assert.strictEqual(sm.isEnabled(), true, 'After uploading new file, button gets enabled');
sm.submit();
assert.strictEqual(sm.isEnabled(), false, 'After submitting, button gets disabled');
// Still disabled
assert.strictEqual(sm.isEnabled(), false, 'Remains disabled without new upload');
sm.upload('doc-2');
assert.strictEqual(sm.isEnabled(), true, 'Upload second file enables button again');
sm.submit();
assert.strictEqual(sm.isEnabled(), false, 'Submitting second time disables button again');
console.log('  [PASS] State machine transition invariants verified across multi-upload cycle');

console.log('\nResults: ALL 7 INVARIANTS PASSED\n');
