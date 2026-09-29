export type JSON =
  { [key: string]: JSON } | JSON[] | number | string | boolean | null;
