import { rm } from "node:fs/promises";
import { join } from "node:path";

const target = join(process.cwd(), ".next");

try {
  await rm(target, { recursive: true, force: true });
  console.log("Cache Next nettoyé: .next");
} catch (error) {
  console.error("Nettoyage du cache Next impossible:", error);
  process.exit(1);
}
