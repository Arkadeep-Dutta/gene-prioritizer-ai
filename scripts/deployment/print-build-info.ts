import { getBuildInfo } from "../../lib/deployment/build-info";

const build = getBuildInfo();

console.log(JSON.stringify(build, null, 2));
