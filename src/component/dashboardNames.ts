export function cleanDashboardName(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

export function dashboardNameKey(value: string) {
  return cleanDashboardName(value).toLocaleLowerCase("it");
}
