export interface FacetColumn {
  key: string;
  label: string;
  fetchValues?: () => Promise<string[]>;
}
