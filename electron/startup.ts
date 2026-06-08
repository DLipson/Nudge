export interface StartupLaunchConfig {
  appPath: string;
  executablePath: string;
  isPackaged: boolean;
}

export interface StartupLaunchOptions {
  args: string[];
  path?: string;
}

export interface StartupLoginItemOptions extends StartupLaunchOptions {
  openAtLogin: boolean;
  openAsHidden: boolean;
}

const hiddenArg = "--hidden";

function quoteShellArgument(argument: string): string {
  if (!/\s/.test(argument)) {
    return argument;
  }

  return `"${argument.replace(/"/g, '\\"')}"`;
}

export function getStartupLaunchOptions({
  appPath,
  executablePath,
  isPackaged,
}: StartupLaunchConfig): StartupLaunchOptions {
  if (isPackaged) {
    return {
      args: [hiddenArg],
    };
  }

  return {
    path: executablePath,
    args: [quoteShellArgument(appPath), hiddenArg],
  };
}

export function getStartupLoginItemOptions(
  enabled: boolean,
  config: StartupLaunchConfig
): StartupLoginItemOptions {
  return {
    openAtLogin: enabled,
    openAsHidden: enabled,
    ...getStartupLaunchOptions(config),
  };
}
