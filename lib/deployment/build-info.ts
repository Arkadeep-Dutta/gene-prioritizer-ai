import packageJson from "@/package.json";

function optionalValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type BuildInfo = {
  appVersion: string;
  buildCommitSha: string | null;
  buildTime: string | null;
  deploymentTarget: string;
};

export function getBuildInfo(environment: NodeJS.ProcessEnv = process.env): BuildInfo {
  return {
    appVersion: optionalValue(environment.APP_VERSION) ?? packageJson.version,
    buildCommitSha: optionalValue(environment.BUILD_COMMIT_SHA),
    buildTime: optionalValue(environment.BUILD_TIME),
    deploymentTarget: optionalValue(environment.DEPLOYMENT_TARGET) ?? "local",
  };
}
