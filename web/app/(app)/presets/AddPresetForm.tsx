"use client";

import EntityForm from "@/components/EntityForm";
import { addPreset } from "./actions";
import PresetFields from "./PresetFields";
import { type InventoryOption } from "./PresetMaterialsField";

interface Option {
  id: number;
  name: string;
}

interface AddPresetFormProps {
  strains: Option[];
  recipes: Option[];
  rooms: Option[];
  items: InventoryOption[];
}

export default function AddPresetForm({ strains, recipes, rooms, items }: AddPresetFormProps) {
  return (
    <EntityForm action={addPreset} submitLabel="Save preset">
      <PresetFields strains={strains} recipes={recipes} rooms={rooms} items={items} />
    </EntityForm>
  );
}
