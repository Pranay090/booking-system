const { writeFileSync } = require('fs');
const { join } = require('path');

const apiUrl = process.env.BACKEND_URL || '';

const content = `export const environment = {
  production: true,
  apiUrl: '${apiUrl}'
};
`;

const outPath = join(__dirname, '..', 'src', 'environments', 'environment.prod.ts');
writeFileSync(outPath, content);
console.log(`environment.prod.ts generated with apiUrl: '${apiUrl || '(empty)'}'`);
