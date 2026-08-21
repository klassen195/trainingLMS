export function excludePlatformOperatorsFromRoster<
  T extends { eq: (column: string, value: boolean) => T },
>(query: T): T {
  return query.eq("is_platform_operator", false);
}
