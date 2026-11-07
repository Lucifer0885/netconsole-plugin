import { patches } from "../src/patches";
import "../src/patches/patches.css";
import { watchPatches } from "../src/patches/watch";
import { loadSettings, watchSettings } from "../src/settings";

export default defineContentScript({
  matches: ["https://netconsole.me/*", "https://*.netconsole.me/*"],
  runAt: "document_idle",
  cssInjectionMode: "manifest",
  main(ctx) {
    let ready = false;
    const run = () => {
      if (!ready) return;
      for (const patch of patches) {
        try {
          patch.apply(document);
        } catch (error) {
          console.error(`[netconsole] ${patch.id}`, error);
        }
      }
    };
    const stopDom = watchPatches(run);
    const stopSettings = watchSettings(run);
    void loadSettings().then(() => {
      ready = true;
      run();
    });
    ctx.onInvalidated(() => {
      stopDom();
      stopSettings();
    });
  },
});
