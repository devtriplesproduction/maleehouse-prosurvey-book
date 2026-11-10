import assert from 'node:assert';

// Verification of custom services creation, sync, and counting logic

const SERVICES_BY_CATEGORY = {
  "Accuracy & Survey Work": [
    "River Survey",
    "Nala",
    "MI Tank Survey",
    "Geo Tagging Survey",
    "Mines Survey"
  ],
  "Plot measurement": [
    "Forest measurement"
  ],
  "Bridge survey": [
    "New Bridge",
    "CD Work",
    "Box Culvert",
    "Slab Culvert",
    "Minor Bridge",
    "Major Bridge",
    "Existing Bridge"
  ],
  "Bandara": [
    "Bandara",
    "KT WEIR"
  ],
  "DAM/ Pazar Talav/ MI Tank": [
    "Dam & Mi Tank",
    "Pazar Talav",
    "1-FSL Line Marking",
    "2-L Section, Cross Section, Existing Line"
  ],
  "Canal Survey": [
    "Main Line",
    "DY",
    "Minor",
    "Sub Minor"
  ],
  "Pipeline Survey": [
    "Command area survey",
    "Existing PDN Survey",
    "New Alignment Survey",
    "Rising Main (command + area)"
  ],
  "Road Survey": [
    "Road survey Existing Road",
    "NH,SH",
    "MDR,ODR,VR",
    "Road Survey New alignment",
    "Hamp road survey"
  ],
  "Other": []
};

function syncFormServices(updatedCustomList, currentServices) {
  const allPresets = new Set(Object.values(SERVICES_BY_CATEGORY).flat());
  const selectedPresets = currentServices.filter((s) => allPresets.has(s));
  const selectedCustoms = updatedCustomList
    .filter((item) => item.selected && item.name.trim().length > 0)
    .map((item) => item.name.trim());

  return Array.from(new Set([...selectedPresets, ...selectedCustoms]));
}

function calculateCategoryCount(cat, selectedServices, customServices) {
  const presetCount = (SERVICES_BY_CATEGORY[cat] || []).filter((s) => selectedServices.includes(s)).length;
  const customCount = customServices.filter(
    (cs) => cs.category === cat && cs.selected
  ).length;
  return presetCount + customCount;
}

// 1. Initial state: preset selection
let currentServices = ["Forest measurement"];
let customServices = [];
let nextServices = syncFormServices(customServices, currentServices);
assert.deepStrictEqual(nextServices, ["Forest measurement"]);
assert.strictEqual(calculateCategoryCount("Plot measurement", nextServices, customServices), 1);

// 2. User types "cccccccccccccccc" and hits Enter -> CREATED as an option
const createdPoint1 = {
  id: "c1",
  category: "Plot measurement",
  name: "cccccccccccccccc",
  selected: true
};
customServices.push(createdPoint1);
nextServices = syncFormServices(customServices, currentServices);
assert.deepStrictEqual(nextServices, ["Forest measurement", "cccccccccccccccc"]);
assert.strictEqual(calculateCategoryCount("Plot measurement", nextServices, customServices), 2);

// 3. User types "jjjjj" and hits Enter -> CREATED as another option
const createdPoint2 = {
  id: "c2",
  category: "Plot measurement",
  name: "jjjjj",
  selected: true
};
customServices.push(createdPoint2);
nextServices = syncFormServices(customServices, currentServices);
assert.deepStrictEqual(nextServices, ["Forest measurement", "cccccccccccccccc", "jjjjj"]);
assert.strictEqual(calculateCategoryCount("Plot measurement", nextServices, customServices), 3);

// 4. User unchecks "cccccccccccccccc"
customServices[0].selected = false;
nextServices = syncFormServices(customServices, nextServices);
assert.deepStrictEqual(nextServices, ["Forest measurement", "jjjjj"]);
assert.strictEqual(calculateCategoryCount("Plot measurement", nextServices, customServices), 2);

// 5. User edits "jjjjj" to "Farm Boundary Demarcation"
customServices[1].name = "Farm Boundary Demarcation";
nextServices = syncFormServices(customServices, nextServices);
assert.deepStrictEqual(nextServices, ["Forest measurement", "Farm Boundary Demarcation"]);

// 6. User deletes "Farm Boundary Demarcation"
customServices = customServices.filter(cs => cs.id !== "c2");
nextServices = syncFormServices(customServices, ["Forest measurement"]);
assert.deepStrictEqual(nextServices, ["Forest measurement"]);
assert.strictEqual(calculateCategoryCount("Plot measurement", nextServices, customServices), 1); // c1 is unselected, c2 is deleted, preset is selected

console.log('All custom services creation, sync, and counting assertions passed!');
