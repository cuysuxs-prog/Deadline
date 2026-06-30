import { stitch } from "@google/stitch-sdk";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ID = "13553722864003948870";

const SCREENS = [
  { id: "73a41de4b77b4981a66afe1a08ef8805", name: "team-management" },
  { id: "356ad9187e4e457d9096d60ac4bf3c98", name: "task-calendar" },
  { id: "2cf321b1141f438a86e915beb5683bde", name: "system-settings" },
  { id: "889ce2a459be4aea877b38edf477216b", name: "near-deadline" },
  { id: "5f8d394f7778499a8947aaea556f24bc", name: "reports-analytics" },
  { id: "da853cd37308424eb555aa0bf6118099", name: "all-tasks-refined-ui" },
  { id: "447c275f60724032ae0ba7a87feeb939", name: "all-tasks" },
  { id: "96d565c00a224f599bff81d2fd9b7671", name: "dashboard-overview" },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "screens");

await fs.mkdir(OUT_DIR, { recursive: true });

console.log("Fetching projects...");
const projects = await stitch.projects();
const project = projects.find((p) => p.id === PROJECT_ID);
if (!project) {
  console.error(`Project ${PROJECT_ID} not found. Available projects:`);
  projects.forEach((p) => console.error(`  ${p.id}: ${p.data?.name ?? "(no name)"}`));
  process.exit(1);
}
console.log(`Found project: ${project.data?.name ?? PROJECT_ID}\n`);

for (const { id, name } of SCREENS) {
  console.log(`Downloading ${name} (${id})...`);
  try {
    const screen = await project.getScreen(id);

    const htmlUrl = await screen.getHtml();
    const htmlRes = await fetch(htmlUrl);
    if (!htmlRes.ok) throw new Error(`HTML fetch failed: ${htmlRes.status}`);
    const html = await htmlRes.text();
    await fs.writeFile(path.join(OUT_DIR, `${name}.html`), html, "utf8");

    const imageUrl = await screen.getImage();
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error(`Image fetch failed: ${imageRes.status}`);
    const imageBuffer = await imageRes.arrayBuffer();
    await fs.writeFile(path.join(OUT_DIR, `${name}.png`), Buffer.from(imageBuffer));

    console.log(`  ✓ ${name}.html + ${name}.png`);
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

console.log(`\nDone. Files saved to: ${OUT_DIR}`);
