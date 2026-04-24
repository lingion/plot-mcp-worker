declare module "@resvg/resvg-wasm/index_bg.wasm" {
  const wasm: ArrayBuffer;
  export default wasm;
}

declare module "*.ttf" {
  const fontData: ArrayBuffer;
  export default fontData;
}
