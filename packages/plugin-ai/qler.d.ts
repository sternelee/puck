declare module "qler" {
  type QlerInstance = {
    queue: (fn: () => void) => void;
  };
  const qler: () => QlerInstance;
  export default qler;
}
