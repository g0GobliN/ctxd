export {
  MEMORY_SOURCES,
  MEMORY_STATUSES,
  MEMORY_TYPES,
  isMemorySource,
  isMemoryStatus,
  isMemoryType,
  type Memory,
  type MemorySource,
  type MemoryStatus,
  type MemoryType,
} from "./types.js";

export {
  authorityRank,
  canOverride,
  defaultConfidence,
  isInferred,
  outranks,
  type OverrideDecision,
} from "./authority.js";

export {
  archiveMemory,
  getMemory,
  listMemories,
  memoryHash,
  saveMemory,
  touchMemory,
  type ListMemoriesOptions,
  type SaveMemoryInput,
  type SaveOutcome,
} from "./repository.js";

export {
  searchMemories,
  toMatchQuery,
  type SearchHit,
  type SearchOptions,
} from "./search.js";

export {
  EXCERPT_BYTES,
  EXTERNALIZE_ABOVE_BYTES,
  toMarkdown,
  writeMemoryBody,
  writeMemoryDigests,
  type ExternalizedContent,
} from "./storage.js";
