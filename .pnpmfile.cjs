/**
 * Hook de pnpm: `openapi-typescript` necesita la compiler API de TypeScript
 * (`ts.factory` para construir el AST) y declara peer `typescript: ^5.x`.
 * El repo usa TypeScript 7 (nativo), que NO expresa esa API, así que sin este
 * hook `pnpm api:types` revienta con "Cannot read properties of undefined".
 *
 * Aquí se le anida typescript@5 SOLO a openapi-typescript; el `tsc` del
 * proyecto (pnpm typecheck) sigue siendo el 7 de devDependencies.
 */
function readPackage(pkg) {
  if (pkg.name === 'openapi-typescript') {
    // Anida TS5 como dependencia real y retira el peer (que pnpm resolvía
    // contra el TS7 raíz): así su import bare 'typescript' cae en el 5.x.
    delete pkg.peerDependencies.typescript;
    pkg.dependencies = { ...pkg.dependencies, typescript: '^5.9.0' };
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
