import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(l => {
  const idx = l.indexOf('=');
  if (idx !== -1) {
    const k = l.substring(0, idx).trim();
    const v = l.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: history } = await supabase
    .from('workflow_history')
    .select('*')
    .eq('project_id', 'PRJ-MH-106')
    .order('created_at', { ascending: false });

  const stages = [
    { label: 'Project Created', key: 'project_created' },
    { label: 'Data Collection', key: 'data_collection' },
    { label: 'Field Team Assignment', key: 'field_assigned' },
    { label: 'Survey Collection', key: 'field_work' },
    { label: 'Survey Validation', key: 'data_sync' },
    { label: 'Final Deliverable', key: 'final_review' },
    { label: 'Delivered', key: 'completed' }
  ];

  const currentIndex = 5; // final_review (Active)

  console.log('\n--- RESOLVED STAGE DATES FOR PRJ-MH-106 ---');
  for (let idx = 0; idx < stages.length; idx++) {
    const stage = stages[idx];
    const isCompleted = idx < currentIndex;
    const isActive = idx === currentIndex;

    let match = history.find(h => 
      h.to_stage === stage.key || 
      h.new_status === stage.key || 
      h.to_status === stage.key
    );

    if (!match && stage.key === 'project_created' && history.length > 0) {
      match = history[history.length - 1];
    }

    if (!match && isCompleted) {
      match = history.find(h => h.from_stage === stage.key);
      if (!match) {
        for (let nextIdx = idx + 1; nextIdx <= currentIndex; nextIdx++) {
          const nextKey = stages[nextIdx].key;
          const nextMatch = history.find(h => h.to_stage === nextKey || h.new_status === nextKey);
          if (nextMatch) { match = nextMatch; break; }
        }
      }
    }

    const dateStr = (isCompleted || isActive) && match
      ? new Date(match.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) + ' ' + new Date(match.created_at).getFullYear()
      : 'none';

    console.log(`${stage.label.padEnd(25)} | ${isCompleted ? 'Completed' : isActive ? 'Active   ' : 'Pending  '} | ${dateStr}`);
  }
}

run();
