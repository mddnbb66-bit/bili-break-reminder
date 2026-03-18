// Minimal generated binding shim for frontend builds.
export class WebviewWindow {
  constructor(source = {}) {
    Object.assign(this, source);
  }

  static createFrom(source = {}) {
    return new WebviewWindow(typeof source === "string" ? JSON.parse(source) : source);
  }
}
