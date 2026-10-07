import {writeFileSync} from 'node:fs';
const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
const part=type=>parts.find(p=>p.type===type).value;
const version=`v0.${part('year')}${part('month')}${part('day')}_${part('hour')}${part('minute')}`;
writeFileSync(new URL('../lib/version.ts',import.meta.url),`// Publication version in Europe/Oslo local time.\nexport const APP_VERSION='${version}';\n`);
console.log(version);
