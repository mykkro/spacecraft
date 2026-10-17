// Source extraction for the lightweight VM checks. No formatting-dependent substrings.
// Node's own parser finds a complete function, including nested objects and callbacks.
const vm = require('node:vm');

function validateName(name) {
  if (!/^[A-Za-z_]\w*$/.test(name)) {
    throw new Error('Expected a simple declaration name: ' + name);
  }
}

function functionSource(source, name) {
  validateName(name);
  const match = new RegExp('^[ \\t]*function\\s+' + name + '\\s*\\(', 'm').exec(source);
  if (!match) throw new Error('Function not found: ' + name);
  const start = source.indexOf('function', match.index);

  for (let end = source.indexOf('}', start); end >= 0; end = source.indexOf('}', end + 1)) {
    const candidate = source.slice(start, end + 1);
    try {
      new vm.Script('(' + candidate + '\n)');
      return candidate;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  throw new Error('Incomplete function: ' + name);
}

function declarationPrefix(source, name) {
  validateName(name);
  const match = new RegExp('^[ \\t]*(?:const|let|var)\\s+' + name + '\\s*=', 'm').exec(source);
  if (!match) throw new Error('Declaration not found: ' + name);
  return source.slice(0, match.index);
}

module.exports = { functionSource, declarationPrefix };

