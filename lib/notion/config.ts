function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export const notionConfig = {
  get parentPageId() {
    return requireEnv("NOTION_PARENT_PAGE_ID");
  },
  get processesDbId() {
    return requireEnv("NOTION_PROCESSES_DB_ID");
  },
  get stepsDbId() {
    return requireEnv("NOTION_STEPS_DB_ID");
  },
};
