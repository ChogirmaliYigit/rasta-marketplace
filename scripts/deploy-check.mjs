import {loadDeployment} from './deploy-config.mjs';
try {
  const {urls}=loadDeployment(process.argv[2]);
  console.log(JSON.stringify({ok:true,...urls},null,2));
  console.log('Konfiguratsiya to‘g‘ri. DNS, server portlari va TLS haqiqiy serverda tekshiriladi.');
} catch(e) { console.error(e.message);process.exitCode=1; }
