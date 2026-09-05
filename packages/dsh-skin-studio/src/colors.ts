export type RGB = { r: number; g: number; b: number }
export type OKLab = { l: number; a: number; b: number }
export type OKLCH = { l: number; c: number; h: number }
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const linear = (n: number) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4
const gamma = (n: number) => n <= .0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - .055
export function hexToRgb(hex: string): RGB { const value = Number.parseInt(hex.slice(1), 16); return { r: value >> 16, g: (value >> 8) & 255, b: value & 255 } }
export function rgbToHex(rgb: RGB): string { return '#' + [rgb.r, rgb.g, rgb.b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('') }
export function rgbToOklab(rgb: RGB): OKLab { const r=linear(rgb.r/255),g=linear(rgb.g/255),b=linear(rgb.b/255); const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b); return {l:.2104542553*l+.793617785*m-.0040720468*s,a:1.9779984951*l-2.428592205*m+.4505937099*s,b:.0259040371*l+.7827717662*m-.808675766*s} }
export function oklabToRgb(ok: OKLab): RGB { const l=(ok.l+.3963377774*ok.a+.2158037573*ok.b)**3,m=(ok.l-.1055613458*ok.a-.0638541728*ok.b)**3,s=(ok.l-.0894841775*ok.a-1.291485548*ok.b)**3; return {r:Math.round(clamp(gamma(4.0767416621*l-3.3077115913*m+.2309699292*s))*255),g:Math.round(clamp(gamma(-1.2684380046*l+2.6097574011*m-.3413193965*s))*255),b:Math.round(clamp(gamma(-.0041960863*l-.7034186147*m+1.707614701*s))*255)} }
export function oklabToOklch(ok: OKLab): OKLCH { const c=Math.hypot(ok.a,ok.b); return {l:ok.l,c,h:(Math.atan2(ok.b,ok.a)*180/Math.PI+360)%360} }
export function oklchToOklab(ok: OKLCH): OKLab { const h=ok.h*Math.PI/180; return {l:ok.l,a:ok.c*Math.cos(h),b:ok.c*Math.sin(h)} }
export function relativeLuminance(hex: string): number { const {r,g,b}=hexToRgb(hex); return .2126*linear(r/255)+.7152*linear(g/255)+.0722*linear(b/255) }
export function contrast(a: string,b: string): number { const values=[relativeLuminance(a),relativeLuminance(b)].sort((m,n)=>n-m); return (values[0]!+.05)/(values[1]!+.05) }
export function ensureContrast(foreground: string, background: string, ratio=4.5): string {
  const initial=rgbToHex(hexToRgb(foreground))
  if(contrast(initial,background)>=ratio)return initial

  const black='#000000',white='#ffffff'
  const target=contrast(black,background)>=contrast(white,background)?black:white
  if(contrast(target,background)<ratio)return target

  const start=rgbToOklab(hexToRgb(initial)),end=rgbToOklab(hexToRgb(target))
  let failing=0,passing=1,result=target
  for(let i=0;i<24;i++){
    const amount=(failing+passing)/2
    const candidate=rgbToHex(oklabToRgb({
      l:start.l+(end.l-start.l)*amount,
      a:start.a+(end.a-start.a)*amount,
      b:start.b+(end.b-start.b)*amount,
    }))
    if(contrast(candidate,background)>=ratio){passing=amount;result=candidate}else failing=amount
  }
  return result
}
export function kMeans(colors: RGB[], count=6, rounds=12): RGB[] { if (!colors.length) return []; const points=colors.map(rgbToOklab); const size=Math.min(count,points.length); const centers: OKLab[]=Array.from({length:size},(_,i)=>points[Math.floor(i*points.length/size)]!); for(let n=0;n<rounds;n++){const bins=centers.map(()=>[] as OKLab[]); for(const p of points){let best=0,d=Infinity; centers.forEach((c,i)=>{const x=(p.l-c.l)**2+(p.a-c.a)**2+(p.b-c.b)**2;if(x<d){d=x;best=i}});bins[best]!.push(p)} bins.forEach((bin,i)=>{if(bin.length) centers[i]=bin.reduce((a,p)=>({l:a.l+p.l/bin.length,a:a.a+p.a/bin.length,b:a.b+p.b/bin.length}),{l:0,a:0,b:0})})} return centers.map(oklabToRgb) }
