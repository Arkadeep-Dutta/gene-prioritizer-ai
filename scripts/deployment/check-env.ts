import { getDeploymentConfig, validateProductionEnvironment } from "../../lib/deployment/env-check";

function main() {
  const config = getDeploymentConfig();
  const result = validateProductionEnvironment();

  console.log(`Deployment target: ${config.deploymentTarget}`);
  console.log(`App environment: ${config.appEnv}`);
  console.log(`Database provider: ${config.databaseProvider}`);
  console.log(`Build version: ${config.build.appVersion}`);

  if (result.warnings.length === 0) {
    console.log("Deployment environment check passed with no warnings.");
    return;
  }

  for (const warning of result.warnings) {
    console.log(`${warning.severity.toUpperCase()} ${warning.code}: ${warning.message}`);
  }

  if (!result.ok) {
    throw new Error("Deployment environment check failed.");
  }

  console.log("Deployment environment check passed with warnings.");
}

main();
