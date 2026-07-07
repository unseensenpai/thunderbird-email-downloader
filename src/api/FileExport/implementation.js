/* global ExtensionCommon, Cc, Ci, Services, IOUtils, PathUtils */

// Experiment APIs run in the privileged parent process with access to
// Thunderbird/Gecko internals: Cc, Ci, Services, IOUtils, PathUtils.
// These identifiers are provided ambiently by the experiment sandbox.

var FileExport = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      FileExport: {
        async pickFolder(title) {
          const win = Services.wm.getMostRecentWindow("mail:3pane");
          const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
          fp.init(win.browsingContext, title, Ci.nsIFilePicker.modeGetFolder);
          const result = await new Promise((resolve) => fp.open(resolve));
          if (result !== Ci.nsIFilePicker.returnOK) {
            return null;
          }
          return fp.file.path;
        },

        async joinPath(base, segments) {
          return PathUtils.join(base, ...segments);
        },

        async makeDir(absolutePath) {
          await IOUtils.makeDirectory(absolutePath, { ignoreExisting: true, createAncestors: true });
        },

        async writeText(absolutePath, text) {
          await IOUtils.writeUTF8(absolutePath, text);
        },

        async writeBytes(absolutePath, byteArray) {
          await IOUtils.write(absolutePath, new Uint8Array(byteArray));
        },
      },
    };
  }
};
