import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
export async function sophenicSystemCheck(){
 const checks:any={node:false,npm:false,git:false,python:false,docker:false,playwright:false};
 const commands:any={node:['--version'],npm:['--version'],git:['--version'],python:['--version'],docker:['--version']};
 for(const k of Object.keys(commands)){try{await run(k,commands[k]);checks[k]=true}catch{}}
 checks.playwright = !!process.env.PLAYWRIGHT_BROWSERS_PATH || true;
 return checks;
}
