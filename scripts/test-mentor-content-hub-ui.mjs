import assert from "node:assert/strict";
import fs from "node:fs";

const dialog = fs.readFileSync(new URL("../src/components/mentors/MentorContentHubDialog.jsx", import.meta.url), "utf8");
const card = fs.readFileSync(new URL("../src/components/dashboard/VideoCard.jsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../src/pages/Dashboard.jsx", import.meta.url), "utf8");

assert.match(dialog, /target="_blank"/);
assert.match(dialog, /rel="noopener noreferrer"/);
assert.match(dialog, /dir="rtl"/);
assert.match(dialog, /max-h-\[88vh\]/);
assert.match(dialog, /grid-cols-2/);
assert.match(card, /event\.stopPropagation\(\); onMentorOpen\(video\)/);
assert.match(card, /aria-label=\{`פתח את מרכז התוכן של/);
assert.match(dashboard, /onMentorOpen=\{selectionMode \? undefined : openMentorContentHub\}/);
assert.match(dashboard, /<MentorContentHubDialog/);

console.log("Mentor Content Hub UI contract: 9 assertions passed");
