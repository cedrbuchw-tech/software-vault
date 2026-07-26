const fs = require('fs');
const parser = require('@babel/parser');
const code = fs.readFileSync('app/auth.jsx','utf8');
try{
  parser.parse(code, { sourceType: 'module', plugins:['jsx','classProperties','optionalChaining','nullishCoalescingOperator','topLevelAwait'] });
  console.log('PARSE OK');
}catch(e){
  console.error('PARSE ERROR:\n', e.message);
  if(e.loc) console.error('LOC:', e.loc);
  process.exit(1);
}
