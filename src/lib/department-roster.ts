export function excludePlatformOperatorsFromRoster<Query>(query: Query): Query {
  return (query as { eq: (column: string, value: boolean) => Query }).eq(
    "is_platform_operator",
    false
  );
}
