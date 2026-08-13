export {
  describeGit,
  gitVersion,
  inspectGit,
  type GitChange,
  type GitCommit,
  type GitInfo,
} from "./git.js";

export { detectProject, projectId, type DetectedProject } from "./detect.js";

export {
  findProjectByRoot,
  getProject,
  indexProjectFiles,
  languageOf,
  listProjects,
  upsertProject,
  type IndexResult,
  type ProjectRow,
} from "./repository.js";

export {
  PROJECT_SUBDIRECTORIES,
  writeProjectStorage,
  type ProjectStorage,
} from "./storage.js";
