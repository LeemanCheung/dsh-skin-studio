import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import styles from './studio.module.css'
import { PRESETS, audit, deriveTokens, preserveLocked } from '../derive.js'
import { hexToRgb, kMeans, rgbToHex } from '../colors.js'
import type { ActiveState, Skin, SkinSummary } from '../schema.js'
import skinStudioRemote from 'dsh-skin-studio/remote'

type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: { message: string } }
type RawApi = { list():Promise<RemoteResult<SkinSummary[]>>; get(id:string):Promise<RemoteResult<Skin|null>>; save(s:Skin):Promise<RemoteResult<Skin>>; deleteSkin(id:string):Promise<RemoteResult<boolean>>; active():Promise<RemoteResult<ActiveState>>; activate(id:string|null):Promise<RemoteResult<ActiveState>>; import(text:string):Promise<RemoteResult<Skin>>; export(id:string):Promise<RemoteResult<string>>; pluginSource(id:string):Promise<RemoteResult<string>> }
type Api = { list():Promise<SkinSummary[]>; get(id:string):Promise<Skin|null>; save(s:Skin):Promise<Skin>; remove(id:string):Promise<boolean>; active():Promise<ActiveState>; activate(id:string|null):Promise<ActiveState>; import(text:string):Promise<Skin>; export(id:string):Promise<string>; pluginSource(id:string):Promise<string> }
type PreviewStyle = React.CSSProperties & Record<'--preview-bg'|'--preview-layer'|'--preview-label'|'--preview-secondary'|'--preview-accent'|'--preview-on-accent'|'--preview-border', string>

const unwrap=async<T,>(pending:Promise<RemoteResult<T>>):Promise<T>=>{const result=await pending;if(!result.ok)throw new Error(result.error.message);return result.value}
const apiFrom=(remote:RawApi,onActivate:(id:string|null)=>Promise<void>):Api=>({
  list:()=>unwrap(remote.list()), get:id=>unwrap(remote.get(id)), save:skin=>unwrap(remote.save(skin)),
  remove:async id=>{const removed=await unwrap(remote.deleteSkin(id));if(removed){const state=await unwrap(remote.active());await onActivate(state.activeId)}return removed},
  active:()=>unwrap(remote.active()), activate:async id=>{const state=await unwrap(remote.activate(id));await onActivate(id);return state},
  import:text=>unwrap(remote.import(text)), export:id=>unwrap(remote.export(id)), pluginSource:id=>unwrap(remote.pluginSource(id)),
})
const uid=()=>`skin-${crypto.randomUUID().slice(0,8)}`
const blank=(seed='#1677ff'):Skin=>{const now=new Date().toISOString();return {format:'dshskin/v1',id:uid(),name:'未命名皮肤',description:'',createdAt:now,updatedAt:now,tokens:deriveTokens(seed),locks:[],source:'manual'}}
const download=(name:string,data:string|Blob,type='application/json')=>{const anchor=document.createElement('a');const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type}));anchor.href=url;anchor.download=name;anchor.click();requestAnimationFrame(()=>URL.revokeObjectURL(url))}

function Studio({api}:{api:Api}) {
  const [skins,setSkins]=useState<SkinSummary[]>([])
  const [skin,setSkin]=useState<Skin>(()=>blank())
  const [active,setActive]=useState<string|null>(null)
  const [history,setHistory]=useState<Skin[]>([])
  const [future,setFuture]=useState<Skin[]>([])
  const [palette,setPalette]=useState<string[]>([])
  const [notice,setNotice]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState('')
  const [confirmDelete,setConfirmDelete]=useState(false)
  const importInput=useRef<HTMLInputElement>(null)
  const objectUrls=useRef(new Set<string>())
  const paletteGeneration=useRef(0)

  const run=async(label:string,task:()=>Promise<void>)=>{setBusy(label);setError('');try{await task()}catch(reason){setError(reason instanceof Error?reason.message:String(reason))}finally{setBusy('')}}
  const refresh=async(preferred?:string)=>{const rows=await api.list();setSkins(rows);const state=await api.active();setActive(state.activeId);const id=preferred??state.activeId??rows[0]?.id;if(id){const selected=await api.get(id);if(selected)setSkin(selected)}}
  useEffect(()=>{void run('正在加载',()=>refresh())},[])
  useEffect(()=>()=>{paletteGeneration.current+=1;for(const url of objectUrls.current)URL.revokeObjectURL(url);objectUrls.current.clear()},[])

  const commit=(next:Skin|((current:Skin)=>Skin))=>{setSkin(current=>{setHistory(items=>[...items,current].slice(-50));setFuture([]);return typeof next==='function'?next(current):next})}
  const undo=()=>setHistory(items=>{const previous=items.at(-1);if(!previous)return items;setFuture(next=>[skin,...next]);setSkin(previous);return items.slice(0,-1)})
  const redo=()=>setFuture(items=>{const next=items[0];if(!next)return items;setHistory(previous=>[...previous,skin].slice(-50));setSkin(next);return items.slice(1)})
  const choose=(id:string)=>void run('正在打开',async()=>{const selected=await api.get(id);if(selected){setSkin(selected);setHistory([]);setFuture([]);setPalette([]);setConfirmDelete(false)}})
  const save=async(message='已保存到本地。')=>{const stored=await api.save(skin);setSkin(stored);setSkins(await api.list());setNotice(message);return stored}
  const preview=()=>void run('正在应用',async()=>{const stored=await save('已保存并应用预览。');await api.activate(stored.id);setActive(stored.id)})
  const stopPreview=()=>void run('正在停用',async()=>{await api.activate(null);setActive(null);setNotice('已恢复默认主题。')})
  const remove=()=>void run('正在删除',async()=>{if(!confirmDelete){setConfirmDelete(true);setNotice('再次点击“确认删除”即可永久删除。');return}await api.remove(skin.id);setConfirmDelete(false);const next=blank();setSkin(next);setHistory([]);setFuture([]);await refresh();setNotice('皮肤已删除。')})
  const applySeed=(seed:string,source:Skin['source']='preset')=>commit(current=>({...current,tokens:preserveLocked(current.tokens,deriveTokens(seed),current.locks),source}))

  const extractPalette=(event:React.ChangeEvent<HTMLInputElement>)=>{const image=event.target.files?.[0];event.target.value='';if(!image)return;if(image.size>10*1024*1024){setError('图片文件不能超过 10 MB。');return}if(!['image/png','image/jpeg','image/webp'].includes(image.type)){setError('仅支持 PNG、JPEG 或 WebP 图片。');return}paletteGeneration.current+=1;const generation=paletteGeneration.current;for(const owned of objectUrls.current)URL.revokeObjectURL(owned);objectUrls.current.clear();const url=URL.createObjectURL(image),element=new Image();objectUrls.current.add(url);const release=()=>{if(objectUrls.current.delete(url))URL.revokeObjectURL(url)};element.onerror=()=>{release();if(generation===paletteGeneration.current)setError('无法解码所选图片。')};element.onload=()=>{try{if(element.width*element.height>40_000_000)throw new Error('图片像素尺寸不能超过 4000 万。');const canvas=document.createElement('canvas'),side=128,scale=Math.min(side/element.width,side/element.height,1);canvas.width=Math.max(1,Math.round(element.width*scale));canvas.height=Math.max(1,Math.round(element.height*scale));const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('当前浏览器不可使用 Canvas。');context.drawImage(element,0,0,canvas.width,canvas.height);const data=context.getImageData(0,0,canvas.width,canvas.height).data,points:{r:number;g:number;b:number}[]=[];for(let index=0;index<data.length;index+=16)if(data[index+3]!>200)points.push({r:data[index]!,g:data[index+1]!,b:data[index+2]!});if(points.length===0)throw new Error('图片中没有可采样的不透明像素。');const colors=kMeans(points,6).map(rgbToHex);if(generation===paletteGeneration.current){setPalette(colors);if(colors[0])applySeed(colors[0],'canvas');setNotice(`已提取 ${colors.length} 个候选颜色，点击色块可切换。`)}}catch(reason){if(generation===paletteGeneration.current)setError(reason instanceof Error?reason.message:String(reason))}finally{release()}};element.src=url}

  const importSkin=(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;void run('正在导入',async()=>{const imported=await api.import(await file.text());await refresh(imported.id);setHistory([]);setFuture([]);setNotice('皮肤已校验并导入。')})}
  const exportSkin=()=>void run('正在导出',async()=>{const stored=await save();download(`${stored.id}.dshskin`,await api.export(stored.id));setNotice('已导出 .dshskin 文件。')})
  const exportPlugin=()=>void run('正在生成',async()=>{const stored=await save();download(`${stored.id}.client.js`,await api.pluginSource(stored.id),'text/javascript');setNotice('已导出可嵌入 DSH Client bundle 的主题源码。')})
  const share=()=>{const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;const context=canvas.getContext('2d');if(!context){setError('当前浏览器不可使用 Canvas。');return}context.fillStyle=skin.tokens['--dsw-alias-bg-base']!.light;context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle=skin.tokens['--dsw-alias-brand-primary']!.light;context.fillRect(70,80,1060,18);context.fillStyle=skin.tokens['--dsw-alias-label-primary']!.light;context.font='bold 64px sans-serif';context.fillText(skin.name,70,220);context.font='30px sans-serif';context.fillStyle=skin.tokens['--dsw-alias-label-secondary']!.light;context.fillText('Created with dsh-skin-studio',70,285);Object.values(skin.tokens).slice(0,7).forEach((value,index)=>{context.fillStyle=value.light;context.fillRect(70+index*145,380,116,116)});canvas.toBlob(blob=>{if(blob)download(`${skin.id}-share.png`,blob,'image/png')},'image/png')}

  const rows=useMemo(()=>Object.entries(skin.tokens),[skin.tokens])
  const audits=audit(skin.tokens)
  const problems=audits.filter(item=>item.light<4.5||item.dark<4.5)
  const previewStyle=(mode:'light'|'dark'):PreviewStyle=>({'--preview-bg':skin.tokens['--dsw-alias-bg-base']![mode],'--preview-layer':skin.tokens['--dsw-alias-bg-layer-1']![mode],'--preview-label':skin.tokens['--dsw-alias-label-primary']![mode],'--preview-secondary':skin.tokens['--dsw-alias-label-secondary']![mode],'--preview-accent':skin.tokens['--dsw-alias-brand-primary']![mode],'--preview-on-accent':skin.tokens['--dsw-alias-label-primary-foreground']![mode],'--preview-border':skin.tokens['--dsw-alias-border-l2']![mode]})

  return <div className={styles.studio} aria-busy={Boolean(busy)}>
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>外观工作台</span><h2>皮肤工坊</h2><p>从一颗种子色生成明暗主题，审计对比度，再安全导出。</p></div>
      <div className={styles.heroActions}><button className={styles.ghost} onClick={undo} disabled={!history.length||Boolean(busy)}>撤销</button><button className={styles.ghost} onClick={redo} disabled={!future.length||Boolean(busy)}>重做</button><button className={styles.primary} onClick={()=>void run('正在保存',async()=>{await save()})} disabled={Boolean(busy)}>保存</button></div>
      {(notice||error||busy)&&<div className={error?styles.error:styles.notice} role={error?'alert':'status'} aria-live="polite">{error||busy||notice}</div>}
    </header>

    <aside className={styles.library} aria-label="皮肤库">
      <div className={styles.sectionHeading}><div><span>Library</span><h3>我的皮肤</h3></div><button className={styles.iconButton} onClick={()=>{setSkin(blank());setHistory([]);setFuture([]);setPalette([])}} aria-label="新建皮肤">＋</button></div>
      <div className={styles.skinList}>{skins.length===0?<p className={styles.empty}>保存后会出现在这里。</p>:skins.map(item=><button key={item.id} className={`${styles.skinItem} ${item.id===skin.id?styles.selected:''}`} onClick={()=>choose(item.id)} aria-current={item.id===skin.id?'true':undefined}><span>{item.name}</span><small>{item.source} · {new Date(item.updatedAt).toLocaleDateString()}</small></button>)}</div>
      <div className={styles.divider}/><span className={styles.groupLabel}>预设起点</span><div className={styles.presetGrid}>{PRESETS.map(preset=><button key={preset.id} className={styles.preset} onClick={()=>applySeed(preset.seed)} title={preset.name}><i style={{background:preset.seed}}/><span>{preset.name}</span></button>)}</div>
      <label className={styles.upload}>从图片提取色板<input type="file" accept="image/png,image/jpeg,image/webp" onChange={extractPalette}/></label>
      {palette.length>0&&<div className={styles.palette} role="group" aria-label="提取的候选颜色">{palette.map(color=><button key={color} style={{background:color}} onClick={()=>applySeed(color,'canvas')} aria-label={`使用颜色 ${color}`} title={color}/>)}</div>}
    </aside>

    <main className={styles.editor}>
      <section className={styles.card}>
        <div className={styles.cardHeader}><div><span>Identity</span><h3>皮肤信息</h3></div><span className={active===skin.id?styles.activeBadge:styles.badge}>{active===skin.id?'正在使用':'草稿'}</span></div>
        <label>名称<input value={skin.name} maxLength={80} onChange={event=>commit({...skin,name:event.target.value})}/></label>
        <label>说明<textarea value={skin.description} maxLength={500} rows={3} placeholder="记录灵感、适用场景或版本说明" onChange={event=>commit({...skin,description:event.target.value})}/></label>
      </section>
      <section className={styles.card}>
        <div className={styles.cardHeader}><div><span>Semantic tokens</span><h3>明暗语义色</h3></div><small>{skin.locks.length} 项已锁定</small></div>
        <div className={styles.tokenTable}>{rows.map(([key,value])=><div className={styles.token} key={key}><div className={styles.tokenName}><code>{key.replace('--dsw-alias-','')}</code><button className={styles.lock} aria-pressed={skin.locks.includes(key)} aria-label={`${skin.locks.includes(key)?'解锁':'锁定'} ${key}`} onClick={()=>commit({...skin,locks:skin.locks.includes(key)?skin.locks.filter(item=>item!==key):[...skin.locks,key]})}>{skin.locks.includes(key)?'已锁定':'锁定'}</button></div>{(['light','dark'] as const).map(mode=><label className={styles.colorField} key={mode}><span>{mode==='light'?'浅色':'深色'}</span><input type="color" value={value[mode]} disabled={skin.locks.includes(key)} onChange={event=>commit({...skin,tokens:{...skin.tokens,[key]:{...value,[mode]:event.target.value}}})}/><input value={value[mode]} disabled={skin.locks.includes(key)} aria-label={`${key} ${mode}`} onChange={event=>{if(/^#[0-9a-f]{6}$/i.test(event.target.value))commit({...skin,tokens:{...skin.tokens,[key]:{...value,[mode]:event.target.value.toLowerCase()}}})}}/></label>)}</div>)}</div>
      </section>
    </main>

    <aside className={styles.inspector} aria-label="主题预览与质量检查">
      <section className={styles.card}><div className={styles.cardHeader}><div><span>Live preview</span><h3>实时预览</h3></div></div>{(['light','dark'] as const).map(mode=><div className={styles.preview} style={previewStyle(mode)} key={mode}><small>{mode==='light'?'浅色模式':'深色模式'}</small><h4>让界面保持专注</h4><p>语义色会同步适配背景、正文、边框和品牌操作。</p><button>主要操作</button></div>)}<div className={styles.actionStack}><button className={styles.primary} onClick={preview} disabled={Boolean(busy)}>保存并应用</button>{active!==null&&<button className={styles.ghost} onClick={stopPreview} disabled={Boolean(busy)}>停止预览</button>}</div></section>
      <section className={styles.card}><div className={styles.cardHeader}><div><span>WCAG AA</span><h3>对比度审计</h3></div><strong className={problems.length?styles.fail:styles.pass}>{problems.length?`${problems.length} 项待修复`:'全部通过'}</strong></div><div className={styles.auditList}>{audits.map(item=><div key={item.foreground}><code>{item.foreground.replace('--dsw-alias-','')}</code><span>浅 {item.light}:1 · 深 {item.dark}:1</span></div>)}</div>{problems.length>0&&<button className={styles.ghost} onClick={()=>applySeed(skin.tokens['--dsw-alias-brand-primary']!.light,'manual')}>自动修复未锁定项</button>}</section>
      <section className={styles.card}><div className={styles.cardHeader}><div><span>Portable</span><h3>导入与交付</h3></div></div><div className={styles.actionStack}><button className={styles.ghost} onClick={()=>importInput.current?.click()}>导入 .dshskin</button><input ref={importInput} hidden type="file" accept=".dshskin,.json" onChange={importSkin}/><button className={styles.ghost} onClick={exportSkin}>导出皮肤</button><button className={styles.ghost} onClick={exportPlugin}>导出 Client 源码</button><button className={styles.ghost} onClick={share}>生成分享卡片</button><button className={confirmDelete?styles.danger:styles.ghost} onClick={remove}>{confirmDelete?'确认删除':'删除当前皮肤'}</button></div></section>
    </aside>
  </div>
}

export const name='dsh-skin-studio-client'
export const inject=['remote','slots','theme']
export async function apply(ctx:ClientContext):Promise<()=>Promise<void>>{
  const disposeRemote=await ctx.remote.$mount(skinStudioRemote)
  const remote=ctx.get('remote.skinStudio') as RawApi|undefined
  if(remote===undefined){await disposeRemote();throw new Error('Skin Studio Remote namespace did not mount')}
  let disposeTheme=()=>{}
  const applyTheme=async(id:string|null):Promise<void>=>{disposeTheme();disposeTheme=()=>{};if(id===null)return;const skin=await unwrap(remote.get(id));if(skin)disposeTheme=ctx.theme.overrideTokens('dsh-skin-studio',skin.tokens)}
  const api=apiFrom(remote,applyTheme)
  const active=await api.active();await applyTheme(active.activeId)
  ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'skin-studio',order:70,label:'皮肤工坊'},()=>React.createElement(Studio,{api})))
  return async()=>{disposeTheme();await disposeRemote()}
}
