import { prototypeFromSpec, type AppEntity, type AppSpec } from "../build/appSpec";
import type { SampleRecord } from "./types";

const entities: readonly string[] = ["lead", "submission", "incident", "task"];
const seedError = () => new Error("Sample records could not be prepared. Use Back or Reset demo to try again.");

function validateEntity(entity: AppEntity): void {
  if (!entities.includes(entity.name) || !entity.fields.length) throw seedError();
  const names = new Set<string>();
  const labels = new Set<string>();
  for (const field of entity.fields) {
    if (!field.name || !field.label || names.has(field.name) || labels.has(field.label)
      || field.samples?.some((sample) => typeof sample !== "string")
      || field.options?.some((option) => typeof option !== "string")) throw seedError();
    names.add(field.name);
    labels.add(field.label);
  }
  if (entity.statusField && !names.has(entity.statusField)) throw seedError();
}

/** Project each entity independently and discard the legacy projection's stats, nav and AI result. */
export function seedRecords(spec: AppSpec): SampleRecord[] {
  if (!spec.entities.length) throw seedError();
  const ids = new Set<string>();
  return spec.entities.flatMap((entity) => {
    validateEntity(entity);
    const items = prototypeFromSpec({ ...spec, entities: [entity] }).items;
    return items.map((item): SampleRecord => {
      if (!item.id || ids.has(item.id) || item.fields?.length !== entity.fields.length) throw seedError();
      ids.add(item.id);
      const values = Object.fromEntries(entity.fields.map((field, index) => {
        const projected = item.fields![index]!;
        if (projected.label !== field.label || typeof projected.value !== "string") throw seedError();
        return [field.name, projected.value];
      }));
      return { id: item.id, entity: entity.name as SampleRecord["entity"], values };
    });
  });
}
