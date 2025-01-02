import debugm from 'debug';
import process from 'node:process';

//const debug = debugm('eczoo_sitegen.scripts.helpers.helperLogs');

const defaultEnableTargets = {
    0: "EczLog*",
    1: "EczLog*,eczoo_sitegen.scripts*",
    2: "EczLog*,zoodb*,ecz*",
    3: "*",
}

export function helperSetDefaultLogs({ enableTargets, verbosityLevel, quietMode }={})
{
    if (process.env.DEBUG == null) {
        if (quietMode ?? false) {
            debugm.enable("");
        } else {
            debugm.enable(enableTargets ?? defaultEnableTargets[verbosityLevel ?? 1]);
        }
    }
}