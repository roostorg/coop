// PoC tool: moves a GraphQL module's resolver object literals into NestJS
// schema-first resolver classes, typed from the graphql-codegen resolver types.
//
// Usage (from server/): node nest/poc-tools/codemod.mjs graphql/modules/manualReviewTool.ts
// Written for the MRT module; other modules need their own class-name prefix
// and helper imports below. Run prettier and remove unused imports afterwards.
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const src = path.resolve(process.argv[2]);
const out = src.replace(/\.ts$/, '.resolvers.ts');
const text = fs.readFileSync(src, 'utf8');
const sf = ts.createSourceFile(src, text, ts.ScriptTarget.Latest, true);
const KEEP_IN_LEGACY = new Set(['NCMECIncidentType', 'resolvers', 'typeDefs']);
const imports = [];
const classes = [];
const mapEntries = [];
const keptStatements = [];
for (const st of sf.statements) {
  if (ts.isImportDeclaration(st)) {
    imports.push(st.getText());
    keptStatements.push(st.getFullText());
    continue;
  }
  if (!ts.isVariableStatement(st)) {
    keptStatements.push(st.getFullText());
    continue;
  }
  const d = st.declarationList.declarations[0];
  const name = d.name.getText();
  if (
    KEEP_IN_LEGACY.has(name) ||
    !d.type ||
    !d.initializer ||
    !ts.isObjectLiteralExpression(d.initializer)
  ) {
    keptStatements.push(st.getFullText());
    continue;
  }
  const typeName = d.type.getText(); // e.g. GQLQueryResolvers
  const isRoot = name === 'Query' || name === 'Mutation';
  const className = isRoot
    ? `ManualReviewTool${name}Resolver`
    : `${name}Resolver`;
  const methods = [];
  for (const prop of d.initializer.properties) {
    let fname, params, body, isAsync;
    if (ts.isMethodDeclaration(prop)) {
      fname = prop.name.getText();
      params = prop.parameters;
      body = prop.body.getText();
      isAsync = !!prop.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.AsyncKeyword,
      );
    } else if (
      ts.isPropertyAssignment(prop) &&
      (ts.isArrowFunction(prop.initializer) ||
        ts.isFunctionExpression(prop.initializer))
    ) {
      const fn = prop.initializer;
      fname = prop.name.getText();
      params = fn.parameters;
      isAsync = !!fn.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.AsyncKeyword,
      );
      body = ts.isBlock(fn.body)
        ? fn.body.getText()
        : `{ return ${fn.body.getText()}; }`;
    } else {
      throw new Error(
        `Unsupported property ${prop.getText().slice(0, 80)} in ${name}`,
      );
    }
    const leading = text.slice(prop.getFullStart(), prop.getStart()).trim();
    const P = `P<${typeName}, '${fname}'>`;
    const paramNames = params.map((p) => p.name.getText());
    let decorator, paramStrs;
    if (isRoot) {
      // Root fields: Nest parameter decorators, so guards and pipes can apply.
      decorator = `@${name}('${fname}')`;
      const decos = ['@Parent()', '@Args()', '@Context()', '@Info()'];
      paramStrs = paramNames.map((pn, i) => `${decos[i]} ${pn}: ${P}[${i}]`);
    } else {
      // Field resolvers: raw (parent, args, context, info), Nest's fast path.
      decorator = `@ResolveField('${fname}')`;
      paramStrs = paramNames.map((pn, i) => `${pn}: ${P}[${i}]`);
    }
    const ret = isAsync
      ? `Promise<Awaited<ReturnType<Fn<${typeName}, '${fname}'>>>>`
      : `ReturnType<Fn<${typeName}, '${fname}'>>`;
    methods.push(
      `${leading ? '  ' + leading + '\n' : ''}  ${decorator}\n  ${isAsync ? 'async ' : ''}${fname}(${paramStrs.join(', ')}): ${ret} ${body}`,
    );
  }
  classes.push(
    `@Resolver('${name}')\nexport class ${className} {\n${methods.join('\n\n')}\n}`,
  );
  mapEntries.push([name, className]);
}
const nestImports = `import { Args, Context, Info, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';`;
const helperImports = `import { assertManualReviewJobIdsWithinLimit, MAX_MANUAL_REVIEW_JOB_IDS } from './manualReviewTool.js';\nimport { type Fn, type P, resolverMapOf } from '../utils/nestResolverTypes.js';`;
const header = `/* eslint-disable max-lines */\n${nestImports}\n${imports.join('\n')}\n${helperImports}\n\nconst { omit, sumBy } = _;\n\n`;
const footer = `\n\n/** The NestJS resolver classes of the MRT module, registered in \`CoopGraphqlModule\`. */\nexport const manualReviewToolResolverClasses = [\n${mapEntries.map(([, c]) => '  ' + c + ',').join('\n')}\n];\n\n/** Plain resolver map built from the classes, for unit tests that call resolvers directly. */\nexport const resolvers = {\n${mapEntries.map(([t, c]) => `  ${t}: resolverMapOf(new ${c}()),`).join('\n')}\n};\n`;
fs.writeFileSync(out, header + classes.join('\n\n') + footer);
fs.writeFileSync(src, keptStatements.join(''));
console.log('classes', mapEntries.length);
