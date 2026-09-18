import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";

const crons = cronJobs();
crons.interval("poll signed KPI catalog", { hours: 1 }, internal.syncActions.refreshCatalog, {});
crons.interval("bounded KPI generation retention", { hours: 24 }, internal.internal.sweepOneOldGeneration, {});
export default crons;
