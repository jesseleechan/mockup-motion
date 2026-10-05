import { getDB } from "./db";
import type { Shot, Style } from "../doc/types";

export interface UserTemplate {
  id: string;
  name: string;
  description: string;
  style: Style;
  shots: Shot[];
  loop: boolean;
  createdAt: number;
}

export async function listUserTemplates(): Promise<UserTemplate[]> {
  const db = await getDB();
  return db.getAll("userTemplates");
}

export async function saveUserTemplate(template: UserTemplate): Promise<void> {
  const db = await getDB();
  await db.put("userTemplates", template);
}

export async function deleteUserTemplate(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("userTemplates", id);
}
