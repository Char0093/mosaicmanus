import Dexie, { type Table } from "dexie";

export type OfflineAnswer = {
  id: string;
  learnerId: string;
  option: string;
  confidence: "guessed" | "unsure" | "knew";
  createdAt: string;
};

class MosaicOfflineDb extends Dexie {
  answers!: Table<OfflineAnswer, string>;

  constructor() {
    super("MosaicClassroomOffline");
    this.version(1).stores({ answers: "id, learnerId, createdAt" });
  }
}

export const offlineDb = new MosaicOfflineDb();

export async function queueAnswer(answer: Omit<OfflineAnswer, "id" | "createdAt">) {
  const record: OfflineAnswer = { ...answer, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await offlineDb.answers.add(record);
  return record;
}

export async function listQueuedAnswers() {
  return offlineDb.answers.orderBy("createdAt").toArray();
}

export async function clearQueuedAnswers(ids: string[]) {
  if (ids.length) await offlineDb.answers.bulkDelete(ids);
}
