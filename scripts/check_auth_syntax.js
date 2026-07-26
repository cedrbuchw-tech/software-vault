const fs = require('fs');
const path = 'app/auth.jsx';
const s = fs.readFileSync(path,'utf8');
function scan(){
  let stack = [];
  let inSingle=false,inDouble=false,inBack=false,inLine=false,inBlock=false;
  for(let i=0;i<s.length;i++){
    const c=s[i], n=s[i+1];
    if(inLine){ if(c=='\n') inLine=false; continue; }
    if(inBlock){ if(c=='*'&&n=='/') { inBlock=false; i++; continue; } else continue; }
    if(!inSingle && !inDouble && !inBack){ if(c=='/' && n=='/') { inLine=true; i++; continue; } if(c=='/' && n=='*'){ inBlock=true; i++; continue; } }
    if(!inSingle && !inDouble && !inLine && !inBlock && c=='`'){ inBack=!inBack; continue; }
    if(!inBack && !inDouble && !inLine && !inBlock && c=="'"){ inSingle=!inSingle; continue; }
    if(!inBack && !inSingle && !inLine && !inBlock && c=='"'){ inDouble=!inDouble; continue; }
    if(!inSingle && !inDouble && !inBack){ if(c=='('||c=='['||c=='{') stack.push(c); if(c==')'){ if(stack.pop()!='(') return 'PARen mismatch at '+i; } if(c==']'){ if(stack.pop()!='[') return 'BRACKET mismatch at '+i; } if(c=='}'){ if(stack.pop()!='{') return 'BRACE mismatch at '+i; } }
  }
  if(inSingle||inDouble||inBack) return 'Unclosed string at EOF';
  if(inLine||inBlock) return 'Unclosed comment at EOF';
  if(stack.length) return 'Unclosed stack: '+stack.join('');
  return 'OK';
}
console.log(scan());
console.log('File length', s.length);
// print surrounding area near reported line 426
const lines = s.split('\n');
for(let i=410;i<=440 && i<lines.length;i++){
  console.log((i+1)+': '+lines[i]);
}
