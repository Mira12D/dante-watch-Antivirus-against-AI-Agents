// Paths inside ~/.dante. DANTE_HOME relocates the folder (tests, second profile).
import { homedir } from "node:os";
import { join } from "node:path";

export const homeDir = () => process.env.DANTE_HOME || join(homedir(), ".dante");
export const userFile = () => join(homeDir(), "user.md");        // what he knows about you - yours to read and change
export const diaryFile = () => join(homeDir(), "diary.jsonl");   // what he did and found, one line per run
// the launcher's extension follows the system: .cmd on Windows, .sh everywhere else
const scriptName = (base, platform = process.platform) => base + (platform === "win32" ? ".cmd" : ".sh");
export const patrolScript = (platform) => join(homeDir(), scriptName("patrol", platform));  // what the schedule starts
export const deepScript = (platform) => join(homeDir(), scriptName("deep", platform));      // what the weekly schedule starts
export const patrolLog = () => join(homeDir(), "patrol.log");
export const guardFile = () => join(homeDir(), "guard.json");  // the Wachschutz identity (id+secret) and activation token
