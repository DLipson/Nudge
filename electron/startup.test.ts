import { describe, expect, it } from "vitest";
import { getStartupLaunchOptions } from "./startup";

describe("getStartupLaunchOptions", () => {
  it("passes the app path when registering an unpackaged Electron app", () => {
    const options = getStartupLaunchOptions({
      appPath: "C:\\Users\\Dovid L\\Dev\\My Cool Projects\\Nudge",
      executablePath:
        "C:\\Users\\Dovid L\\Dev\\My Cool Projects\\Nudge\\node_modules\\electron\\dist\\electron.exe",
      isPackaged: false,
    });

    expect(options).toEqual({
      path: "C:\\Users\\Dovid L\\Dev\\My Cool Projects\\Nudge\\node_modules\\electron\\dist\\electron.exe",
      args: ["C:\\Users\\Dovid L\\Dev\\My Cool Projects\\Nudge", "--hidden"],
    });
  });
});
