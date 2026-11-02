import {readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export async function advanceVersion(root,level='patch') {
  if(!['patch','minor','major'].includes(level))throw new Error('Choose patch (default), minor, or major.');
  const packagePath=path.join(root,'package.json'),lockPath=path.join(root,'package-lock.json');
  const metadata=JSON.parse(await readFile(packagePath,'utf8')),lock=JSON.parse(await readFile(lockPath,'utf8'));
  if(!/^\d+\.\d+\.\d+$/.test(metadata.version)||lock.version!==metadata.version||lock.packages?.['']?.version!==metadata.version)throw new Error('Package and lockfile versions must match before a release.');
  const [major,minor,patch]=metadata.version.split('.').map(Number);
  const version=level==='major'?`${major+1}.0.0`:level==='minor'?`${major}.${minor+1}.0`:`${major}.${minor}.${patch+1}`;
  metadata.version=version;lock.version=version;lock.packages[''].version=version;
  for(const [file,data] of [[packagePath,metadata],[lockPath,lock]]){
    const temporary=`${file}.release-${process.pid}`;
    await writeFile(temporary,JSON.stringify(data,null,2)+'\n');await rename(temporary,file);
  }
  return version;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  try{
    if(process.argv.length>3)throw new Error('Usage: npm run release -- [patch|minor|major]');
    console.log(`Prepared SkyTuner v${await advanceVersion(process.cwd(),process.argv[2]??'patch')}. Review, test, and publish this version together.`);
  }catch(error){console.error(error.message);process.exitCode=1;}
}
