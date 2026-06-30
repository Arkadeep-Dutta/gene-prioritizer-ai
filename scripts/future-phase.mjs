const [phase, capability] = process.argv.slice(2);

if (!phase || !capability) {
  console.error("Future-phase placeholder is missing its phase or capability label.");
  process.exitCode = 1;
} else {
  console.log(`${capability} is not implemented until Phase ${phase}.`);
}
