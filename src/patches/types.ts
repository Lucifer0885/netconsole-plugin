export type Patch = {
  id: string;
  apply: (root: Document) => void;
};
