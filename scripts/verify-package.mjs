import { existsSync, readFileSync } from 'node:fs'

const root = new URL('../packages/dsh-skin-studio/lib/', import.meta.url)
const required = ['index.js', 'index.d.ts', 'client.js', 'client.d.ts', 'typert.host.js', 'typert.host.d.ts', 'typert.remote-client.js', 'typert.remote-client.d.ts']
const missing = required.filter(file => !existsSync(new URL(file, root)))
if (missing.length > 0) {
  console.error('Missing release artifacts:', missing.join(', '))
  process.exit(1)
}
const manifests=[
  JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')),
  JSON.parse(readFileSync(new URL('../packages/dsh-skin-studio/package.json',import.meta.url),'utf8')),
]
for(const manifest of manifests){
  const compatibility=manifest.dsh?.compatibility
  if(compatibility?.dsh!=='>=0.1.2-rc.1 <0.1.3-0'||compatibility?.dshReleases?.['0.1.2-rc.1']!=='compatible'||compatibility?.profiles?.join(',')!=='web'){
    console.error('Missing verified DSH 0.1.2-rc.1 Web compatibility metadata.')
    process.exit(1)
  }
}
console.log('Verified release artifacts for dsh-skin-studio.')
