/** A string as an SQL literal, for the files these scripts hand to `wrangler d1 execute`. */
export const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`
