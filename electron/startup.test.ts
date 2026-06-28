import path from "path";
import { describe, expect, it } from "vitest";
import {
  getStartupLaunchOptions,
  getUnpackagedStartupAppPath,
} from "./startup";

const appRoot = "C:\\Users\\Dovid L\\Dev\\My Cool Projects\\Nudge";
const electronExecutablePath = `${appRoot}\\node_modules\\electron\\dist\\electron.exe`;

describe("getUnpackagedStartupAppPath", () => {
  it("uses the project root instead of the compiled Electron output directory", () => {
    expect(
      getUnpackagedStartupAppPath(path.join(appRoot, "dist-electron"))
    ).toBe(appRoot);
  });
});

describe("getStartupLaunchOptions", () => {
  it("passes the app path when registering an unpackaged Electron app", () => {
    const options = getStartupLaunchOptions({
      appPath: appRoot,
      executablePath: electronExecutablePath,
      isPackaged: false,
    });

    expect(options).toEqual({
      path: electronExecutablePath,
      args: ['"C:\\Users\\Dovid L\\Dev\\My Cool Projects\\Nudge"', "--hidden"],
    });
  });

  it("does not register dist-electron as the app path for an unpackaged Electron app", () => {
    const compiledMainDirectory = path.join(appRoot, "dist-electron");
    const options = getStartupLaunchOptions({
      appPath: getUnpackagedStartupAppPath(compiledMainDirectory),
      executablePath: electronExecutablePath,
      isPackaged: false,
    });

    expect(options.args[0]).toBe(
      '"C:\\Users\\Dovid L\\Dev\\My Cool Projects\\Nudge"'
    );
    expect(options.args[0]).not.toContain("dist-electron");
  });
});
