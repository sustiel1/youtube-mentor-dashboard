// entities.js — Centralized access to all Base44 entities
// Entity names must match exactly what was created in the Base44 platform.
//
// When VITE_ENABLE_BASE44 !== "true", stubs reject — hooks must use local paths first.

import { base44 } from "./base44Client";

function stubEntity(name) {
  const reject = () =>
    Promise.reject(
      new Error(
        `[local-first] ${name} — Base44 כבוי. הגדר VITE_ENABLE_BASE44=true לסנכרון שרת.`,
      ),
    );
  return {
    list: reject,
    filter: reject,
    create: reject,
    update: reject,
    delete: reject,
  };
}

export const Mentor = base44?.entities?.Mentor ?? stubEntity("Mentor");
export const Source = base44?.entities?.Source ?? stubEntity("Source");
export const Video = base44?.entities?.Video ?? stubEntity("Video");
export const ProcessingJob = base44?.entities?.ProcessingJob ?? stubEntity("ProcessingJob");
export const Topic = base44?.entities?.Topic ?? stubEntity("Topic");
export const Note = base44?.entities?.Note ?? stubEntity("Note");
export const Category = base44?.entities?.Category ?? stubEntity("Category");
