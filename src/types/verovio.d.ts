declare module "verovio/wasm" {
  const create: () => Promise<unknown>;
  export default create;
}
declare module "verovio/esm" {
  export class VerovioToolkit {
    constructor(module: unknown);
    setOptions(options: Record<string, unknown>): void;
    loadData(data: string): boolean;
    redoLayout(options?: Record<string, unknown>): void;
    renderToSVG(page: number): string;
    getPageCount(): number;
    destroy(): void;
  }
}
