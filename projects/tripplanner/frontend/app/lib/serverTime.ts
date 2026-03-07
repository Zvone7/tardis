let serverStartTime: string | null = null;

export function getServerStartTime(): string {
  if (!serverStartTime) {
    serverStartTime = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }
  return serverStartTime;
}