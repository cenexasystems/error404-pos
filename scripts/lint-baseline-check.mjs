import {ESLint} from 'eslint';import {execFileSync} from 'node:child_process';import {readFile} from 'node:fs/promises';
const eslint=new ESLint();const files=execFileSync('git',['diff','--name-only'],{encoding:'utf8'}).trim().split('\n').filter(f=>/\.(tsx?|jsx?)$/.test(f));let before=0,after=0;
for(const file of files){const old=execFileSync('git',['show',`HEAD:${file}`],{encoding:'utf8'});const now=await readFile(file,'utf8');const [a]=await eslint.lintText(old,{filePath:file});const [b]=await eslint.lintText(now,{filePath:file});before+=a.errorCount;after+=b.errorCount;if(b.errorCount>a.errorCount)console.log(file,b.messages.filter(m=>m.severity===2));}
console.log({baselineErrorsInChangedFiles:before,currentErrorsInChangedFiles:after});
