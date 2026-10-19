import {spawnSync} from 'node:child_process';
import {loadDeployment} from './deploy-config.mjs';
try {
  const {urls}=loadDeployment(process.argv[2]);
  const result=spawnSync('pnpm',['--filter','@rasta/mobile','build:native'],{stdio:'inherit',env:{...process.env,EXPO_PUBLIC_API_URL:urls.api}});
  if(result.error) throw result.error;
  process.exitCode=result.status ?? 1;
} catch(e) {console.error(e.message);process.exitCode=1;}
