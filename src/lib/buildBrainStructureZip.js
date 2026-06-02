import JSZip from 'jszip';
import { BRAIN_STRUCTURE } from '@/config/brainStructure';

function brainIndex(brainName) {
  return [
    `# ${brainName}`,
    '',
    'This folder is part of the Personal Brain structure.',
  ].join('\n');
}

function subBrainIndex(brainName, subBrainName) {
  return [
    `# ${subBrainName}`,
    '',
    `Brain: ${brainName}`,
    `SubBrain: ${subBrainName}`,
    '',
    'Purpose:',
    'This folder is part of the Personal Brain structure.',
  ].join('\n');
}

/**
 * Builds a JSZip with the complete Obsidian Brain/SubBrain scaffold.
 *
 * Structure:
 *   Workspace/
 *     {Brain}/_index.md
 *     {Brain}/{SubBrain}/_index.md
 *     ...
 *
 * Source of truth: src/config/brainStructure.js
 */
export function buildBrainStructureZip() {
  const zip = new JSZip();

  for (const [brainName, subBrains] of Object.entries(BRAIN_STRUCTURE)) {
    zip.file(`Workspace/${brainName}/_index.md`, brainIndex(brainName));

    for (const subBrainName of subBrains) {
      zip.file(
        `Workspace/${brainName}/${subBrainName}/_index.md`,
        subBrainIndex(brainName, subBrainName),
      );
    }
  }

  return zip;
}

export function countBrainStructure() {
  const brains = Object.keys(BRAIN_STRUCTURE).length;
  const subBrains = Object.values(BRAIN_STRUCTURE).reduce((s, arr) => s + arr.length, 0);
  return { brains, subBrains, total: brains + subBrains };
}
