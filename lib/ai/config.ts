function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export const aiConfig = {
  get anthropicApiKey() {
    return requireEnv("ANTHROPIC_API_KEY");
  },
};
