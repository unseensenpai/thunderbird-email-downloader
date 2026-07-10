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

        async readTextIfExists(absolutePath) {
          try {
            return await IOUtils.readUTF8(absolutePath);
          } catch (err) {
            // Absence is not an error: the first export has no index yet.
            // Anything else (permissions, I/O) must propagate.
            if (err?.name === "NotFoundError") return null;
            throw err;
          }
        },

        async deleteFile(absolutePath) {
          await IOUtils.remove(absolutePath, { ignoreAbsent: true });
        },

        async confirmDuplicates(total, duplicateCount) {
          const win = Services.wm.getMostRecentWindow("mail:3pane");
          const ps = Services.prompt;

          // Button indices are stable across platforms even though the visual
          // order is not. Index 1 is also what confirmEx returns when the dialog
          // is dismissed with the window's X button, so "Cancel" sits at index 1
          // — dismissing must never overwrite files.
          const flags =
            ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING +
            ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING +
            ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;

          const pressed = ps.confirmEx(
            win,
            "Mükerrer e-postalar",
            `${total} e-postadan ${duplicateCount} tanesi bu klasöre daha önce aktarılmış. Ne yapılsın?`,
            flags,
            "Üzerine yaz",
            "İptal",
            "Atla",
            null,
            { value: false }
          );

          if (pressed === 0) return "overwrite";
          if (pressed === 2) return "skip";
          return "cancel";
        },
      },
    };
  }
};
