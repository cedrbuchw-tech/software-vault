/* eslint-disable @next/next/no-img-element */
"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { AuthButton, useAuth, fetchMyLikes, setLike, openAuthModal, likeHint, fetchMyLibrary, setLibrary, libT } from "./auth";
import { useBackdropClose, useScrollLock } from "@/lib/modal_ux";
import { loadAppearance, applyAppearance } from "@/lib/appearance";

const K = { admin:"vault_admin",progs:"vault_programs",likes:"vault_likes",
            dark:"vault_dark",lang:"vault_lang",sett:"vault_settings",found:"vault_found" };
const partyUnlockedKey = (userId) => userId ? `vault_party_unlocked_${userId}` : null;
const partyEnabledKey  = (userId) => userId ? `vault_party_enabled_${userId}` : null;
const CATS  = ["All","Tools","Games","Utilities","Media","Dev","Other"];
const OSS   = [{id:"win",l:"Windows"},{id:"mac",l:"macOS"},{id:"lin",l:"Linux"},{id:"web",l:"Web"}];
const BLANK = {name:"",desc:"",ver:"1.0",cat:"Tools",url:"",file:null,os:[],coverImage:null,screenshots:[]};
const LANGS = [{c:"en",l:"EN"},{c:"de",l:"DE"},{c:"es",l:"ES"},{c:"no",l:"NO"},
               {c:"pt",l:"PT"},{c:"ja",l:"JA"},{c:"zh",l:"ZH"},{c:"ru",l:"RU"}];
const BLANK_DL = {name:"",desc:"",url:"",enabled:false};
const OS_DL = [{id:"win",l:"Windows"},{id:"mac",l:"macOS"},{id:"lin",l:"Linux"}];
const freshBuilds = () => ({win:{file:null,url:""},mac:{file:null,url:""},lin:{file:null,url:""}});
const freshEditBuilds = () => ({win:{file:null,url:"",remove:false},mac:{file:null,url:"",remove:false},lin:{file:null,url:"",remove:false}});
const hasBuilds = (p) => !!(p && p.downloads && OS_DL.some(o => p.downloads[o.id] && p.downloads[o.id].url));
function DownloadButtons({prog,onDownload,loadingDl,th,tr,full}){
  const dls = prog.downloads || {};
  const avail = OS_DL.filter(o => dls[o.id] && dls[o.id].url);
  const busy = loadingDl === prog.id;
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:6,...(full?{flex:1}:{width:"100%"})}}>
      {avail.map(o => (
        <button key={o.id} onClick={(e)=>{e.stopPropagation();onDownload(prog,o.id);}}
          style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,background:"#e03d0c",color:th.card,border:th.bdr,cursor:"pointer",padding:"9px 8px",flex:"1 1 auto",letterSpacing:.3}}>
          {busy?tr.loading:("↓ "+o.l)}
        </button>
      ))}
    </div>
  );
}

const SECRET_LABELS = [
  {trigger:"Broken Code Sequence",
   hint:"Enter the hidden keyboard sequence",
   howto:"Press Up Up Down Down Left Right Left Right anywhere on the page. Code lock cracked."},
  {trigger:"Pulse Overload",
   hint:"Click the logo five times fast",
   howto:"Click the 'Vault' icon in the header five times quickly. Fault spawned."},
  {trigger:"Core Breach",
   hint:"Hold the hero title until the core unlocks",
   howto:"Hold the main title for 1.2 seconds. Core unlocked."},
  {trigger:'Command "open"',
   hint:'Type the vault access word outside inputs',
   howto:'Type O-P-E-N outside text fields. Gate opened.'},
  {trigger:"Audit Spike",
   hint:"Probe the counters with a fast tap pattern",
   howto:"Click the program/download/featured counters five times quickly. Audit spiked."},
  {trigger:"Faultline Trace",
   hint:"Hold Alt while hovering the footer Vault label",
   howto:"Hover footer \"Vault\" text while holding Alt for 2.5 seconds. Trace detected."},
  {trigger:"Card Fault",
   hint:"Hold any program title until it glitches",
   howto:"Hold a program title for 1.5 seconds. Card fault triggered."},
  {trigger:"Debug Probe",
   hint:"Type debug in the search field",
   howto:"Type debug in search and press Enter. Debug mode active."},
  {trigger:"Schema Override",
   hint:"Shift-click the theme toggle",
   howto:"Shift+click the theme switch. Schema override injected."},
  {trigger:"Schema Flip",
   hint:"Flip themes until the schema fractures",
   howto:"Toggle theme ten times rapidly. Schema fractured."},
  {trigger:"Data Cascade",
   hint:"Right-click a program card to trigger cascade",
   howto:"Right-click and hold on any program card for 2 seconds. Data cascade initiated."},
  {trigger:"Vault Resonance",
   hint:"Click the featured badge repeatedly until resonance",
   howto:"Click the featured badge (★) 7 times rapidly. Vault resonates."},
];

const fmt = {
  n: n => n>=1000?(n/1000).toFixed(1)+"k":String(n||0),
  b: n => !n?"":n<1024?n+"B":n<1048576?(n/1024).toFixed(0)+"KB":(n/1048576).toFixed(1)+"MB",
  d: s => s?new Date(s).toLocaleDateString("en",{month:"short",day:"numeric",year:"numeric"}):"",
  isNew: s => s && (Date.now()-new Date(s).getTime()) < 7*24*60*60*1000,
};

function CountUp({to,duration=1000}) {
  const [n,setN]=useState(0);
  useEffect(()=>{
    if(!to){requestAnimationFrame(()=>setN(0));return;}
    let start=null;
    const step=ts=>{
      if(!start)start=ts;
      const p=Math.min((ts-start)/duration,1);
      setN(Math.floor((to)*(1-Math.pow(1-p,3))));
      if(p<1)requestAnimationFrame(step); else setN(to);
    };
    const raf=requestAnimationFrame(step);
    return ()=>cancelAnimationFrame(raf);
  },[to,duration]);
  return <>{n>=1000?(n/1000).toFixed(1)+"k":String(n)}</>;
}

const compressImage=(file,maxW,quality)=>new Promise(res=>{
  const reader=new FileReader();
  reader.onload=ev=>{
    const src=ev.target.result; if(!src){res(null);return;}
    const img=new Image();
    img.onload=()=>{
      try{
        const sc=Math.min(1,maxW/img.width);
        const canvas=document.createElement("canvas");
        canvas.width=Math.max(1,Math.round(img.width*sc));
        canvas.height=Math.max(1,Math.round(img.height*sc));
        const ctx=canvas.getContext("2d");
        if(!ctx){res(src);return;}
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const out=canvas.toDataURL("image/jpeg",quality);
        res(out&&out.length>100?out:src);
      }catch{res(src);}
    };
    img.onerror=()=>res(src); img.src=src;
  };
  reader.onerror=()=>res(null); reader.readAsDataURL(file);
});

const TR = {
  en:{h1:["Software I build","and give away."],sub:"I made this website to upload all of my small projects that I have created out of boredom for people to download and use for free. If you like what I upload, you can send me a little donation at the bottom of the page.",
    progs:"programs",dls:"downloads",feat:"featured",search:"Search programs...",platform:"Platform:",
    clear:"clear",sn:"Newest first",sp:"Most downloaded",sa:"A → Z",fdiv:"★ featured",adiv:"everything",
    dl:"Download ↓",open:"Open ↗",dl_n:"downloads",lk:"likes",e1:"Nothing here yet — check back soon.",e2:"No results.",
    cats:["All","Tools","Games","Utilities","Media","Dev","Other"],
    adm:"admin",ap:"admin panel",vv:"← back",so:"sign out",si:"Sign in",
    sat:"Set up admin",cp:"Change password",adh:"Admin",cpb:"change password",
    add:"Add something new",mgmt:"Manage",nl:"name *",vl:"version",cl:"category",
    dl2:"description",pl:"compatible platforms",ul:"download URL",fl:"file (max 4 MB)",
    lu:"link a URL",uf:"upload file",ab:"Add program",adng:"Adding...",
    pin:"pin",upin:"unpin",ed:"edit",del:"delete",yd:"yes, delete",
    cncl:"cancel",sv:"save",sc:"save changes",ca:"create account",
    pw:"password",pwm:"password (min 6 chars)",pwn:"new password (min 6 chars)",
    conf:"confirm password",ot:"One-time setup. Only this device can sign in as admin.",
    lw:"Stored in your browser. Clear browser data = lose access.",
    kf:"leave blank to keep existing file",bf:"For big files (>4 MB), paste a Google Drive, Dropbox, or GitHub Releases link.",
    stp:"programs",std:"downloads",stpin:"pinned",sttop:"top program",
    anh:"Announcement",anph:"Write a message for visitors...",ant:"type",ani:"info",anw:"warning",anu:"update",
    ans:"Save",anc:"Clear",anl:"Banner is live",edh:"Edit program",
    pph:"Donations",ppurl:"Your PayPal.me URL",ppvis:"Show to visitors",
    pp:"♥ Support this project",ppm:"If something here helped you out, a small donation means a lot.",
    ppadm:"Donations / Support",ppmsglbl:"Message for visitors (optional)",
    ss:"Site settings",hsl:"Hero subtitle (shown under the title)",
    cov:"Cover image",scr:"Screenshots (up to 6)",cls:"Close",
    img_tip:"Images are compressed automatically. JPEG/PNG/WebP accepted.",
    loading:"Loading..."},
  de:{h1:["Software, die ich baue","und verschenke."],sub:"Ich habe diese Website erstellt, um all meine kleinen Projekte hochzuladen.",
    progs:"Programme",dls:"Downloads",feat:"empfohlen",search:"Programme suchen...",platform:"Plattform:",
    clear:"löschen",sn:"Neueste zuerst",sp:"Meiste Downloads",sa:"A → Z",fdiv:"★ empfohlen",adiv:"alles",
    dl:"Herunterladen ↓",open:"Öffnen ↗",dl_n:"Downloads",lk:"Likes",e1:"Noch nichts hier.",e2:"Keine Ergebnisse.",
    cats:["Alle","Tools","Spiele","Dienstprogramme","Medien","Entwicklung","Sonstiges"],
    adm:"Admin",ap:"Admin-Bereich",vv:"← zurück",so:"Abmelden",si:"Anmelden",
    sat:"Admin einrichten",cp:"Passwort ändern",adh:"Admin",cpb:"Passwort ändern",
    add:"Neues hinzufügen",mgmt:"Verwalten",nl:"Name *",vl:"Version",cl:"Kategorie",
    dl2:"Beschreibung",pl:"Kompatible Plattformen",ul:"Download-URL",fl:"Datei (max. 4 MB)",
    lu:"URL verlinken",uf:"Datei hochladen",ab:"Programm hinzufügen",adng:"Wird hinzugefügt...",
    pin:"anheften",upin:"lösen",ed:"bearbeiten",del:"löschen",yd:"Ja, löschen",
    cncl:"Abbrechen",sv:"Speichern",sc:"Änderungen speichern",ca:"Konto erstellen",
    pw:"Passwort",pwm:"Passwort (mind. 6 Zeichen)",pwn:"Neues Passwort",
    conf:"Passwort bestätigen",ot:"Einmalige Einrichtung.",lw:"Lokal gespeichert.",
    kf:"leer lassen für bestehende Datei",bf:"Für große Dateien einen Link einfügen.",
    stp:"Programme",std:"Downloads",stpin:"angeheftet",sttop:"Top-Programm",
    anh:"Ankündigung",anph:"Nachricht für Besucher...",ant:"Typ",ani:"Info",anw:"Warnung",anu:"Update",
    ans:"Speichern",anc:"Löschen",anl:"Banner ist aktiv",edh:"Programm bearbeiten",
    pph:"Spenden",ppurl:"PayPal.me URL",ppvis:"Besuchern anzeigen",
    pp:"♥ Projekt unterstützen",ppm:"Danke für deine Unterstützung.",
    ppadm:"Spenden",ppmsglbl:"Nachricht für Besucher",
    ss:"Site-Einstellungen",hsl:"Untertitel",cov:"Titelbild",
    scr:"Screenshots (bis zu 6)",cls:"Schließen",img_tip:"Bilder werden automatisch komprimiert.",loading:"Lädt..."},
  es:{h1:["Software que creo","y comparto gratis."],sub:"Creé este sitio para subir todos mis pequeños proyectos.",
    progs:"programas",dls:"descargas",feat:"destacados",search:"Buscar...",platform:"Plataforma:",
    clear:"borrar",sn:"Más recientes",sp:"Más descargados",sa:"A → Z",fdiv:"★ destacados",adiv:"todo",
    dl:"Descargar ↓",open:"Abrir ↗",dl_n:"descargas",lk:"me gusta",e1:"Nada todavía.",e2:"Sin resultados.",
    cats:["Todo","Herramientas","Juegos","Utilidades","Medios","Dev","Otros"],
    adm:"admin",ap:"panel admin",vv:"← volver",so:"cerrar sesión",si:"Iniciar sesión",
    sat:"Crear admin",cp:"Cambiar contraseña",adh:"Admin",cpb:"cambiar contraseña",
    add:"Agregar algo nuevo",mgmt:"Gestionar",nl:"nombre *",vl:"versión",cl:"categoría",
    dl2:"descripción",pl:"plataformas compatibles",ul:"URL de descarga",fl:"archivo (máx. 4 MB)",
    lu:"enlazar URL",uf:"subir archivo",ab:"Agregar programa",adng:"Agregando...",
    pin:"fijar",upin:"desfijar",ed:"editar",del:"eliminar",yd:"sí, eliminar",
    cncl:"Cancelar",sv:"Guardar",sc:"Guardar cambios",ca:"Crear cuenta",
    pw:"contraseña",pwm:"contraseña (mín. 6 caracteres)",pwn:"nueva contraseña",
    conf:"confirmar contraseña",ot:"Configuración única.",lw:"Guardado en tu navegador.",
    kf:"dejar en blanco para mantener archivo",bf:"Para archivos grandes, usa un enlace.",
    stp:"programas",std:"descargas",stpin:"fijados",sttop:"top programa",
    anh:"Anuncio",anph:"Escribe un mensaje...",ant:"tipo",ani:"info",anw:"aviso",anu:"actualización",
    ans:"Guardar",anc:"Borrar",anl:"Banner activo",edh:"Editar programa",
    pph:"Donaciones",ppurl:"URL de PayPal.me",ppvis:"Mostrar a visitantes",
    pp:"♥ Apoya este proyecto",ppm:"Una pequeña donación significa mucho.",
    ppadm:"Donaciones",ppmsglbl:"Mensaje para visitantes",
    ss:"Ajustes",hsl:"Subtítulo del hero",cov:"Imagen de portada",
    scr:"Capturas (hasta 6)",cls:"Cerrar",img_tip:"Las imágenes se comprimen automáticamente.",loading:"Cargando..."},
  no:{h1:["Programvare jeg lager","og gir bort gratis."],sub:"Jeg laget denne nettsiden for å laste opp alle mine små prosjekter.",
    progs:"programmer",dls:"nedlastinger",feat:"fremhevet",search:"Søk...",platform:"Plattform:",
    clear:"fjern",sn:"Nyeste først",sp:"Mest nedlastet",sa:"A → Z",fdiv:"★ fremhevet",adiv:"alt",
    dl:"Last ned ↓",open:"Åpne ↗",dl_n:"nedlastinger",lk:"likerklikk",e1:"Ingenting her ennå.",e2:"Ingen resultater.",
    cats:["Alle","Verktøy","Spill","Verktøy","Medier","Dev","Annet"],
    adm:"admin",ap:"adminpanel",vv:"← tilbake",so:"logg ut",si:"Logg inn",
    sat:"Opprett admin",cp:"Endre passord",adh:"Admin",cpb:"endre passord",
    add:"Legg til noe nytt",mgmt:"Administrer",nl:"navn *",vl:"versjon",cl:"kategori",
    dl2:"beskrivelse",pl:"kompatible plattformer",ul:"nedlastings-URL",fl:"fil (maks 4 MB)",
    lu:"lenk en URL",uf:"last opp fil",ab:"Legg til program",adng:"Legger til...",
    pin:"fest",upin:"løsne",ed:"rediger",del:"slett",yd:"ja, slett",
    cncl:"Avbryt",sv:"Lagre",sc:"Lagre endringer",ca:"Opprett konto",
    pw:"passord",pwm:"passord (min. 6 tegn)",pwn:"nytt passord",
    conf:"bekreft passord",ot:"Engangsoppsett.",lw:"Lagret lokalt.",
    kf:"la stå tomt for å beholde fil",bf:"For store filer, bruk en lenke.",
    stp:"programmer",std:"nedlastinger",stpin:"festet",sttop:"toppprogram",
    anh:"Kunngjøring",anph:"Skriv en melding...",ant:"type",ani:"info",anw:"advarsel",anu:"oppdatering",
    ans:"Lagre",anc:"Fjern",anl:"Banner er aktiv",edh:"Rediger program",
    pph:"Donasjoner",ppurl:"PayPal.me URL",ppvis:"Vis til besøkende",
    pp:"♥ Støtt prosjektet",ppm:"En liten donasjon er kjærkomment.",
    ppadm:"Donasjoner",ppmsglbl:"Melding til besøkende",
    ss:"Nettstedinnstillinger",hsl:"Hero-undertittel",cov:"Forsidebilde",
    scr:"Skjermbilder (opptil 6)",cls:"Lukk",img_tip:"Bilder komprimeres automatisk.",loading:"Laster..."},
  pt:{h1:["Software que eu crio","e distribuo de graça."],sub:"Criei este site para publicar todos os meus pequenos projetos.",
    progs:"programas",dls:"downloads",feat:"em destaque",search:"Buscar...",platform:"Plataforma:",
    clear:"limpar",sn:"Mais recentes",sp:"Mais baixados",sa:"A → Z",fdiv:"★ em destaque",adiv:"tudo",
    dl:"Baixar ↓",open:"Abrir ↗",dl_n:"downloads",lk:"curtidas",e1:"Nada aqui ainda.",e2:"Sem resultados.",
    cats:["Tudo","Ferramentas","Jogos","Utilitários","Mídia","Dev","Outros"],
    adm:"admin",ap:"painel admin",vv:"← voltar",so:"sair",si:"Entrar",
    sat:"Configurar admin",cp:"Alterar senha",adh:"Admin",cpb:"alterar senha",
    add:"Adicionar algo novo",mgmt:"Gerenciar",nl:"nome *",vl:"versão",cl:"categoria",
    dl2:"descrição",pl:"plataformas compatíveis",ul:"URL de download",fl:"arquivo (máx. 4 MB)",
    lu:"link de URL",uf:"enviar arquivo",ab:"Adicionar programa",adng:"Adicionando...",
    pin:"fixar",upin:"desafixar",ed:"editar",del:"excluir",yd:"sim, excluir",
    cncl:"Cancelar",sv:"Salvar",sc:"Salvar alterações",ca:"Criar conta",
    pw:"senha",pwm:"senha (mín. 6 caracteres)",pwn:"nova senha",
    conf:"confirmar senha",ot:"Configuração única.",lw:"Armazenado no navegador.",
    kf:"deixe em branco para manter o arquivo",bf:"Para arquivos grandes, use um link.",
    stp:"programas",std:"downloads",stpin:"fixados",sttop:"mais baixado",
    anh:"Anúncio",anph:"Escreva uma mensagem...",ant:"tipo",ani:"info",anw:"aviso",anu:"atualização",
    ans:"Salvar",anc:"Limpar",anl:"Banner ativo",edh:"Editar programa",
    pph:"Doações",ppurl:"URL do PayPal.me",ppvis:"Mostrar para visitantes",
    pp:"♥ Apoiar no PayPal",ppm:"Uma pequena doação significa muito.",
    ppadm:"Doações",ppmsglbl:"Mensagem para visitantes",
    ss:"Configurações",hsl:"Subtítulo do hero",cov:"Imagem de capa",
    scr:"Capturas (até 6)",cls:"Fechar",img_tip:"Imagens são comprimidas automaticamente.",loading:"Carregando..."},
  ja:{h1:["私が作るソフトウェアを","無料で公開しています。"],sub:"暇つぶしで作ったちょっとしたプロジェクトを、みんなに無料で使ってもらえるよう公開するために作ったサイトです。",
    progs:"プログラム",dls:"DL",feat:"おすすめ",search:"検索...",platform:"プラットフォーム：",
    clear:"クリア",sn:"新着順",sp:"DL数順",sa:"A → Z",fdiv:"★ おすすめ",adiv:"すべて",
    dl:"ダウンロード ↓",open:"開く ↗",dl_n:"DL",lk:"いいね",e1:"まだ何もありません。",e2:"結果がありません。",
    cats:["すべて","ツール","ゲーム","ユーティリティ","メディア","開発","その他"],
    adm:"管理者",ap:"管理パネル",vv:"← 戻る",so:"ログアウト",si:"サインイン",
    sat:"管理者を設定",cp:"パスワード変更",adh:"管理者",cpb:"パスワード変更",
    add:"新しく追加",mgmt:"管理",nl:"名前 *",vl:"バージョン",cl:"カテゴリ",
    dl2:"説明",pl:"対応プラットフォーム",ul:"ダウンロードURL",fl:"ファイル (最大4MB)",
    lu:"URLを貼る",uf:"アップロード",ab:"追加する",adng:"追加中...",
    pin:"固定",upin:"解除",ed:"編集",del:"削除",yd:"はい、削除",
    cncl:"キャンセル",sv:"保存",sc:"変更を保存",ca:"アカウント作成",
    pw:"パスワード",pwm:"パスワード（6文字以上）",pwn:"新パスワード",
    conf:"パスワードを確認",ot:"初回設定。",lw:"ブラウザに保存。",
    kf:"既存ファイルを維持する場合は空白",bf:"大きなファイルはリンクを。",
    stp:"プログラム",std:"DL数",stpin:"固定",sttop:"人気",
    anh:"お知らせ",anph:"訪問者へのメッセージ...",ant:"種類",ani:"情報",anw:"警告",anu:"更新",
    ans:"保存",anc:"消去",anl:"バナー表示中",edh:"プログラムを編集",
    pph:"寄付",ppurl:"PayPal.me URL",ppvis:"訪問者に表示",
    pp:"♥ PayPalで支援する",ppm:"役に立ったら、小さな支援がとても励みになります。",
    ppadm:"寄付 / 支援",ppmsglbl:"訪問者へのメッセージ",
    ss:"サイト設定",hsl:"ヒーローのサブタイトル",cov:"カバー画像",
    scr:"スクリーンショット（最大6枚）",cls:"閉じる",img_tip:"画像は自動的に圧縮されます。",loading:"読込中..."},
  zh:{h1:["我开发的软件","全部免费分享。"],sub:"我建立这个网站，是为了分享我因无聊而创作的各种小项目。",
    progs:"程序",dls:"下载",feat:"精选",search:"搜索...",platform:"平台：",
    clear:"清除",sn:"最新",sp:"最多下载",sa:"A → Z",fdiv:"★ 精选",adiv:"全部",
    dl:"下载 ↓",open:"打开 ↗",dl_n:"下载",lk:"点赞",e1:"暂时没有内容。",e2:"没有搜索结果。",
    cats:["全部","工具","游戏","实用工具","媒体","开发","其他"],
    adm:"管理员",ap:"管理面板",vv:"← 返回",so:"退出",si:"登录",
    sat:"设置管理员",cp:"修改密码",adh:"管理员",cpb:"修改密码",
    add:"添加新内容",mgmt:"管理",nl:"名称 *",vl:"版本",cl:"分类",
    dl2:"描述",pl:"支持平台",ul:"下载链接",fl:"文件（最大4MB）",
    lu:"链接URL",uf:"上传文件",ab:"添加程序",adng:"添加中...",
    pin:"置顶",upin:"取消置顶",ed:"编辑",del:"删除",yd:"确认删除",
    cncl:"取消",sv:"保存",sc:"保存更改",ca:"创建账号",
    pw:"密码",pwm:"密码（至少6位）",pwn:"新密码",
    conf:"确认密码",ot:"一次性设置。",lw:"存储在浏览器中。",
    kf:"留空以保留现有文件",bf:"较大文件请使用链接。",
    stp:"程序",std:"下载",stpin:"置顶",sttop:"最热门",
    anh:"公告横幅",anph:"为访客写一条消息...",ant:"类型",ani:"信息",anw:"警告",anu:"更新",
    ans:"保存",anc:"清除",anl:"横幅已启用",edh:"编辑程序",
    pph:"捐赠",ppurl:"PayPal.me 链接",ppvis:"向访客显示",
    pp:"♥ 通过PayPal支持",ppm:"如果这里对您有所帮助，一小笔捐赠意义重大。",
    ppadm:"捐赠 / 支持",ppmsglbl:"访客消息",
    ss:"网站设置",hsl:"主页副标题",cov:"封面图片",
    scr:"截图（最多6张）",cls:"关闭",img_tip:"图片会自动压缩。",loading:"加载中..."},
  ru:{h1:["Программы, которые я делаю","и раздаю бесплатно."],sub:"Я создал этот сайт, чтобы делиться небольшими проектами от скуки.",
    progs:"программы",dls:"скачивания",feat:"избранное",search:"Поиск...",platform:"Платформа:",
    clear:"сбросить",sn:"Сначала новые",sp:"По скачиваниям",sa:"А → Я",fdiv:"★ избранное",adiv:"все",
    dl:"Скачать ↓",open:"Открыть ↗",dl_n:"скач.",lk:"лайки",e1:"Пока ничего.",e2:"Ничего не найдено.",
    cats:["Все","Инструменты","Игры","Утилиты","Медиа","Разработка","Прочее"],
    adm:"Админ",ap:"панель admin",vv:"← назад",so:"выйти",si:"Войти",
    sat:"Настроить админа",cp:"Сменить пароль",adh:"Админ",cpb:"сменить пароль",
    add:"Добавить программу",mgmt:"Управление",nl:"название *",vl:"версия",cl:"категория",
    dl2:"описание",pl:"совместимые платформы",ul:"ссылка для скачивания",fl:"файл (макс. 4 МБ)",
    lu:"вставить URL",uf:"загрузить файл",ab:"Добавить программу",adng:"Добавляем...",
    pin:"закрепить",upin:"открепить",ed:"изменить",del:"удалить",yd:"да, удалить",
    cncl:"Отмена",sv:"Сохранить",sc:"Сохранить изменения",ca:"Создать аккаунт",
    pw:"пароль",pwm:"пароль (мин. 6 символов)",pwn:"новый пароль",
    conf:"подтвердить пароль",ot:"Первичная настройка.",lw:"Хранится в браузере.",
    kf:"оставьте пустым для сохранения файла",bf:"Для больших файлов используйте ссылку.",
    stp:"программы",std:"скачивания",stpin:"закреплено",sttop:"топ программа",
    anh:"Объявление",anph:"Напишите сообщение...",ant:"тип",ani:"инфо",anw:"внимание",anu:"обновление",
    ans:"Сохранить",anc:"Убрать",anl:"Баннер активен",edh:"Изменить программу",
    pph:"Пожертвования",ppurl:"Ссылка PayPal.me",ppvis:"Показать посетителям",
    pp:"♥ Поддержать через PayPal",ppm:"Пожертвование поддержит проект.",
    ppadm:"Пожертвования",ppmsglbl:"Сообщение для посетителей",
    ss:"Настройки сайта",hsl:"Подзаголовок главной",cov:"Обложка",
    scr:"Скриншоты (до 6)",cls:"Закрыть",img_tip:"Изображения сжимаются автоматически.",loading:"Загрузка..."},
};

const THEMES = {
  light:{bg:"#f0ece0",card:"#ffffff",blk:"#111111",mut:"#999990",org:"#e03d0c",
    shd:"4px 4px 0 #111111",sh2:"2px 2px 0 #111111",bdr:"2px solid #111111",
    inputBg:"#ffffff",div:"#e0dbd0",heroBg:"#ffffff",
    annC:{info:{bg:"#dbeafe",b:"#93c5fd",t:"#1e3a8a"},warning:{bg:"#fef3c7",b:"#fbbf24",t:"#92400e"},update:{bg:"#d1fae5",b:"#34d399",t:"#065f46"}}},
  dark:{bg:"#141414",card:"#1c1c1c",blk:"#e8e4d8",mut:"#666660",org:"#e03d0c",
    shd:"4px 4px 0 #555",sh2:"2px 2px 0 #444",bdr:"2px solid #e8e4d8",
    inputBg:"#252525",div:"#2a2a2a",heroBg:"#141414",
    annC:{info:{bg:"#1e3a5f",b:"#3b82f6",t:"#93c5fd"},warning:{bg:"#451a03",b:"#f59e0b",t:"#fde68a"},update:{bg:"#064e3b",b:"#10b981",t:"#a7f3d0"}}},
};

function Btn({children,v="ghost",onClick,disabled,sm,th,full,style={}}) {
  const [pressed,setPressed]=useState(false);
  const [hovered,setHovered]=useState(false);
  const bg  = v==="primary"?th.org:v==="dark"?th.blk:th.card;
  const fg  = (v==="primary"||v==="dark")?th.card:v==="danger"?th.org:th.blk;
  const bdr = v==="danger"?`2px solid ${th.org}`:th.bdr;
  const shadowOffset = pressed ? "3px 3px" : hovered ? "4px 4px" : "3px 3px";
  const buttonTransform = pressed ? "translate(1px,1px)" : hovered ? "translate(-1px,-1px)" : "none";
  const shadowInverse = pressed ? "translate(-1px,-1px)" : hovered ? "translate(1px,1px)" : "none";

  return (
    <button style={{
      padding:sm?"6px 12px":"10px 20px",width:full?"100%":"auto",
      border:bdr,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.5:1,
      fontFamily:"'IBM Plex Mono',monospace",fontSize:sm?11:12,
      display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5,
      background:bg,color:fg,
      boxShadow:`${shadowOffset} 0 ${th.sh2.split(" ").slice(3).join(" ")}`,
      transform:buttonTransform,
      transition:"filter 0.1s ease, transform 0.1s ease, box-shadow 0.1s ease",
      userSelect:"none",outline:"none",...style,
    }}
      onClick={onClick} disabled={disabled}
      onMouseEnter={()=>{if(!disabled)setHovered(true);}}
      onMouseLeave={()=>{setHovered(false);setPressed(false);}}
      onMouseDown={()=>{if(!disabled)setPressed(true);}}
      onMouseUp={()=>setPressed(false)}
    >{children}</button>
  );
}

function usePressStyle(th) {
  const [pressed,setPressed]=useState(false);
  const [hovered,setHovered]=useState(false);
  const shColor=th.sh2.split(" ").slice(3).join(" ");
  const shadow = pressed
    ? `drop-shadow(1px 1px 0 ${shColor})`
    : hovered
    ? `drop-shadow(4px 4px 0 ${shColor})`
    : `drop-shadow(3px 3px 0 ${shColor})`;
  return {
    btnStyle:{filter:shadow,transform:pressed?"translate(1px,1px)":hovered?"translate(-1px,-1px)":"none",transition:"filter 0.1s ease, transform 0.1s ease"},
    handlers:{onMouseEnter:(e)=>{e.stopPropagation();setHovered(true);},onMouseLeave:(e)=>{e.stopPropagation();setHovered(false);setPressed(false);},onMouseDown:(e)=>{e.stopPropagation();setPressed(true);},onMouseUp:(e)=>{e.stopPropagation();setPressed(false);}},
  };
}

function OsToggle({val,onChange,th}) {
  return <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
    {OSS.map(o=>(
      <label key={o.id} style={{padding:"5px 10px",border:th.bdr,cursor:"pointer",
        fontFamily:"'IBM Plex Mono',monospace",fontSize:11,userSelect:"none",
        background:val.includes(o.id)?th.blk:th.card,
        color:val.includes(o.id)?th.card:th.blk,transition:"all .1s"}}>
        <input type="checkbox" checked={val.includes(o.id)} onChange={()=>onChange(o.id)} style={{display:"none"}}/>
        {o.l}
      </label>
    ))}
  </div>;
}

function SecretDownloadCard({dl,accentColor,textColor,bgColor,borderColor}) {
  if(!dl?.enabled||!dl?.name) return null;
  const ac=accentColor||"#e03d0c",tc=textColor||"#ccc",
        bg=bgColor||"rgba(255,255,255,.04)",bc=borderColor||"rgba(255,255,255,.1)";
  return(
    <div style={{border:`1px solid ${bc}`,padding:"16px 20px",background:bg,marginBottom:18,animation:"vaultReveal .4s ease .15s both"}}>
      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:ac,marginBottom:10,letterSpacing:2}}>↳ FREE DOWNLOAD UNLOCKED</div>
      <div style={{fontFamily:"'Anton',sans-serif",fontSize:20,color:tc,letterSpacing:.3,marginBottom:4}}>{dl.name}</div>
      {dl.desc&&<p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:tc,opacity:.55,lineHeight:1.75,marginBottom:dl.url?12:0}}>{dl.desc}</p>}
      {dl.url&&(
        <button onClick={()=>window.open(dl.url,"_blank")} style={{
          padding:"8px 20px",background:ac,color:"#fff",border:"none",
          cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:1,
          filter:"drop-shadow(2px 2px 0 rgba(0,0,0,.45))",
          transition:"filter 0.1s ease, transform 0.1s ease"}}
          onMouseEnter={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";e.currentTarget.style.filter="drop-shadow(3px 3px 0 rgba(0,0,0,.5))";}}
          onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.filter="drop-shadow(2px 2px 0 rgba(0,0,0,.45))";}}
          onMouseDown={e=>{e.currentTarget.style.transform="translate(1px,1px)";e.currentTarget.style.filter="drop-shadow(1px 1px 0 rgba(0,0,0,.4))";}}
          onMouseUp={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";e.currentTarget.style.filter="drop-shadow(3px 3px 0 rgba(0,0,0,.5))";}}
>
          Open ↗
        </button>
      )}
    </div>
  );
}

function Divider({label,th}) {
  return(
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
      {label&&<span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.mut,whiteSpace:"nowrap"}}>{label}</span>}
      <div style={{flex:1,height:1,background:th.div}}/>
    </div>
  );
}

function ImageUploadField({label,tip,single,images,onChange,onRemove,th,lbl,maxCount=6}) {
  const ref=useRef();
  const limit=single?1:maxCount;
  return(
    <div style={{marginBottom:14}}>
      <label style={lbl}>{label}</label>
      <input ref={ref} type="file" accept="image/*" multiple={!single} style={{display:"none"}} onChange={onChange}/>
      {images.length<limit&&(
        <button type="button" onClick={()=>ref.current.click()} style={{padding:"8px 16px",border:`1px dashed ${th.mut}`,background:"none",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.mut,width:"100%",marginBottom:images.length?8:0}}>
          + {label}
        </button>
      )}
      {images.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
          {images.map((img,i)=>(
            <div key={i} style={{position:"relative",border:th.bdr}}>
              <img src={img} alt={`uploaded image ${i+1}`} style={{width:"100%",height:72,objectFit:"cover",display:"block"}}/>
              <button onClick={()=>onRemove(i)} style={{position:"absolute",top:3,right:3,width:20,height:20,border:"none",background:"rgba(0,0,0,.6)",color:"#fff",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>
            </div>
          ))}
        </div>
      )}
      {tip&&<p style={{fontSize:10,color:th.mut,marginTop:6,fontFamily:"'IBM Plex Mono',monospace"}}>{tip}</p>}
    </div>
  );
}

function DetailModal({prog,liked,onLike,onDownload,loadingDl,onClose,th,tr,inLibrary,onToggleLibrary,lt}) {
  // a drag that merely ENDS on the backdrop must not discard the dialog, and
  // the page behind it stays put while it is open
  const backdrop = useBackdropClose(onClose);
  useScrollLock();
  const [slide,setSlide]=useState(0);
  const [heartAnim,setHeartAnim]=useState(false);
  const dlPress=usePressStyle(th);
  const imgs=[prog.coverImage,...(prog.screenshots||[])].filter(Boolean);
  const catIdx=CATS.indexOf(prog.cat);
  const catLabel=catIdx>0?(tr.cats[catIdx]||prog.cat):prog.cat;
  const doLike=()=>{if(!liked){setHeartAnim(true);setTimeout(()=>setHeartAnim(false),420);}onLike(prog.id);};
  return(
    <div {...backdrop} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:th.card,border:th.bdr,width:"100%",maxWidth:700,maxHeight:"92vh",overflowY:"auto",boxShadow:`10px 10px 0 ${th.blk}`,animation:"fadeIn .15s ease"}}>
        {imgs.length>0&&(
          <div style={{position:"relative",background:"#000",height:300,flexShrink:0}}>
            <img src={imgs[slide]} alt={prog.name} style={{width:"100%",height:"100%",objectFit:"contain",display:"block"}}/>
            {imgs.length>1&&(<>
              <button onClick={()=>setSlide(s=>(s-1+imgs.length)%imgs.length)} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",background:th.card,border:th.bdr,width:36,height:36,cursor:"pointer",fontSize:16,color:th.blk,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
              <button onClick={()=>setSlide(s=>(s+1)%imgs.length)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:th.card,border:th.bdr,width:36,height:36,cursor:"pointer",fontSize:16,color:th.blk,display:"flex",alignItems:"center",justifyContent:"center"}}>→</button>
              <div style={{position:"absolute",bottom:10,left:"50%",transform:"translateX(-50%)",display:"flex",gap:6}}>
                {imgs.map((_,i)=><button key={i} onClick={()=>setSlide(i)} style={{width:8,height:8,borderRadius:"50%",border:"none",cursor:"pointer",padding:0,background:i===slide?"#fff":"rgba(255,255,255,.35)"}}/>)}
              </div>
              <div style={{position:"absolute",top:10,right:10,background:"rgba(0,0,0,.5)",color:"#fff",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,padding:"3px 8px"}}>{slide+1}/{imgs.length}</div>
            </>)}
          </div>
        )}
        <div style={{padding:28}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              <span style={{fontSize:10,padding:"3px 8px",border:th.bdr,fontFamily:"'IBM Plex Mono',monospace",background:prog.featured?th.blk:th.card,color:prog.featured?th.card:th.blk}}>{prog.featured?"★ ":""}{catLabel}</span>
              <span style={{fontSize:10,padding:"3px 7px",border:`1px solid ${th.div}`,color:th.mut,fontFamily:"'IBM Plex Mono',monospace"}}>v{prog.ver||"1.0"}</span>
              {(prog.os||[]).map(o=><span key={o} style={{fontSize:10,padding:"2px 6px",border:`1px solid ${th.div}`,color:th.mut,fontFamily:"'IBM Plex Mono',monospace"}}>{OSS.find(x=>x.id===o)?.l||o}</span>)}
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:th.mut,padding:0,lineHeight:1,marginLeft:10,flexShrink:0}}>{tr.cls} ✕</button>
          </div>
          <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:28,fontWeight:400,letterSpacing:.3,marginBottom:12,color:th.blk,lineHeight:1.1}}>{prog.name}</h2>
          {prog.desc&&<p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:th.mut,lineHeight:1.85,marginBottom:18}}>{prog.desc}</p>}
          <div style={{display:"flex",gap:20,flexWrap:"wrap",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.mut,paddingTop:14,borderTop:`1px solid ${th.div}`,marginBottom:18}}>
            <span>{fmt.d(prog.date)}</span><span>{fmt.n(prog.dl)} {tr.dl_n}</span>
            <span>♥ {fmt.n(prog.likes||0)} {tr.lk}</span>
            {prog.fileSize&&<span>{fmt.b(prog.fileSize)}</span>}
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={doLike} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",border:`2px solid ${liked?"#e03d0c":th.div}`,background:liked?"#e03d0c":th.card,color:liked?th.card:th.blk,cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,flexShrink:0,...dlPress.btnStyle,filter:liked?"none":dlPress.btnStyle.filter,transition:"background .15s, border-color .15s, filter 0.1s, transform 0.1s"}} {...dlPress.handlers}>
              <span style={{fontSize:16,animation:heartAnim?"heartPop .42s cubic-bezier(.22,1,.36,1) both":"none"}}>{liked?"♥":"♡"}</span>{fmt.n(prog.likes||0)}
            </button>
            {onToggleLibrary&&<button onClick={()=>onToggleLibrary(prog.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",border:`2px solid ${inLibrary?"#16a34a":th.div}`,background:inLibrary?"#16a34a":th.card,color:inLibrary?th.card:th.blk,cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,flexShrink:0}}>{inLibrary?(lt?.saved||"✓ Saved"):(lt?.save||"+ Save")}</button>}
            {hasBuilds(prog) ? (<DownloadButtons prog={prog} onDownload={onDownload} loadingDl={loadingDl} th={th} tr={tr} full/>) : (<button onClick={()=>onDownload(prog)} style={{flex:1,padding:"10px",background:"#e03d0c",color:th.card,border:th.bdr,cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:13,letterSpacing:.5,...dlPress.btnStyle}} {...dlPress.handlers}>
              {loadingDl===prog.id?tr.loading:((prog.os||[]).includes("web")?tr.open:tr.dl)}
            </button>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgramCard({p,onDownload,onLike,liked,onDetail,onTitleHold,onContextMenu,onFeaturedClick,loadingDl,th,tr,customDlBtn,corruptionLevel,inLibrary,onToggleLibrary,lt}) {
  const [hov,setHov]=useState(false);
  const [heartAnim,setHeartAnim]=useState(false);
  const titleHoldTimer=useRef(null);
  const titleHeld=useRef(false);
  const dlPress=usePressStyle(th);
  const keepHoverRef=useRef(null);

  const doLike=(e)=>{
    e?.stopPropagation?.();
    setHov(true);
    if(!liked){setHeartAnim(true);setTimeout(()=>setHeartAnim(false),420);}
    onLike(p.id);
  };

  const handleTitleDown=()=>{
    titleHeld.current=true;
    clearTimeout(titleHoldTimer.current);
    titleHoldTimer.current=setTimeout(()=>{
      if(titleHeld.current){ onTitleHold?.(p); }
    },1500);
  };
  const handleTitleUp=()=>{ titleHeld.current=false; clearTimeout(titleHoldTimer.current); };
  const catIdx=CATS.indexOf(p.cat);
  const catLabel=catIdx>0?(tr.cats[catIdx]||p.cat):p.cat;
  const hasImages=p.coverImage||(p.screenshots||[]).length>0;
  const isNew=fmt.isNew(p.date);
  const rightClickTimer=useRef(null);
  const rightClicked=useRef(false);
  const handleContextMenu=(e)=>{
    e.preventDefault();
    rightClicked.current=true;
    rightClickTimer.current=setTimeout(()=>{
      if(rightClicked.current){ onContextMenu?.(p); }
    },2000);
  };
  const handleContextMenuEnd=()=>{ rightClicked.current=false; clearTimeout(rightClickTimer.current); };
  const handleMouseLeave=(e)=>{
    if(e.target.closest("button")) return;
    handleContextMenuEnd();
    setTimeout(()=>setHov(false), 0);
  };
  const handleDownloadClick=(e)=>{
    e.stopPropagation?.();
    setHov(true);
    onDownload(p);
  };
  return(
    <article className="program-card" onContextMenu={handleContextMenu} onMouseUp={handleContextMenuEnd} onMouseEnter={()=>setHov(true)} onMouseLeave={handleMouseLeave} style={{
      background:corruptionLevel >= 9 ? `hsl(${Math.random()*360}, 70%, 50%)` : th.card,border:th.bdr,display:"flex",flexDirection:"column",position:"relative",
      boxShadow:hov?"6px 6px 0 "+th.blk:th.shd,transform:hov?"translate(-2px,-2px)":"none",
      transition:"box-shadow .14s,transform .14s",
      animation:p.featured&&!hov?"featPulse 3s ease infinite":corruptionLevel >= 8 ? "contentShake 0.4s steps(1) infinite" : "none",
      opacity: corruptionLevel >= 10 ? 0.85 : 1,
      filter: corruptionLevel >= 11 ? `blur(${corruptionLevel * 0.05}px) contrast(${1 + corruptionLevel * 0.1})` : 'none'
    }}>
      {isNew&&(
        <div style={{position:"absolute",top:-1,right:12,zIndex:10,background:"#e03d0c",color:"#fff",fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:2,padding:"3px 8px",fontWeight:500,animation:"newPulse 2s ease infinite"}}>NEW</div>
      )}
      {p.coverImage&&(
        <div onClick={()=>onDetail(p)} style={{height:160,overflow:"hidden",borderBottom:th.bdr,cursor:"pointer",flexShrink:0,background:"#000"}}>
          <img src={p.coverImage} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block",transition:"transform .2s",transform:hov?"scale(1.02)":"scale(1)"}}/>
        </div>
      )}
      <div style={{padding:"18px",display:"flex",flexDirection:"column",flex:1}}>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
          <span onClick={p.featured?onFeaturedClick:undefined} style={{fontSize:10,padding:"3px 8px",border:th.bdr,fontFamily:"'IBM Plex Mono',monospace",background:p.featured?th.blk:th.card,color:p.featured?th.card:th.blk,cursor:p.featured?"pointer":"default"}}>{p.featured?"★ ":""}{catLabel}</span>
          <span style={{fontSize:10,padding:"3px 7px",border:`1px solid ${th.div}`,color:th.mut,fontFamily:"'IBM Plex Mono',monospace"}}>v{p.ver||"1.0"}</span>
        </div>
        <h2 onClick={hasImages?()=>onDetail(p):undefined} onMouseDown={handleTitleDown} onMouseUp={handleTitleUp} onMouseLeave={handleTitleUp} onTouchStart={handleTitleDown} onTouchEnd={handleTitleUp} style={{fontFamily:"'Anton',sans-serif",fontSize:22,fontWeight:400,letterSpacing:.3,lineHeight:1.05,marginBottom:6,color:th.blk,cursor:hasImages?"pointer":"default"}}>{p.name}</h2>
        {(p.os||[]).length>0&&(
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
            {(p.os||[]).map(o=><span key={o} style={{fontSize:9,padding:"2px 6px",border:`1px solid ${th.div}`,color:th.mut,fontFamily:"'IBM Plex Mono',monospace"}}>{OSS.find(x=>x.id===o)?.l||o}</span>)}
          </div>
        )}
        {p.desc&&<p style={{fontSize:12,color:th.mut,lineHeight:1.72,flex:1,marginBottom:14,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:p.coverImage?2:3,WebkitBoxOrient:"vertical",fontFamily:"'IBM Plex Mono',monospace"}}>{p.desc}</p>}
        <button onClick={doLike} style={{
          width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px 0",marginBottom:8,
          border:`2px solid ${liked?"#e03d0c":"#e03d0c66"}`,
          background:liked?"#e03d0c":"transparent",
          color:liked?th.card:"#e03d0c",cursor:"pointer",
          fontFamily:"'IBM Plex Mono',monospace",fontSize:12,
          filter:`drop-shadow(2px 2px 0 ${liked?"#c5330a":"#e03d0c44"})`,
          transition:"background .12s, border-color .12s, filter 0.1s, transform 0.1s",
        }}
          onMouseEnter={e=>{e.stopPropagation();e.currentTarget.style.transform="translate(-1px,-1px)";e.currentTarget.style.filter=`drop-shadow(3px 3px 0 ${liked?"#c5330a":"#e03d0c66"})`;if(!liked)e.currentTarget.style.background="#e03d0c18";}}
          onMouseLeave={e=>{e.stopPropagation();e.currentTarget.style.transform="none";e.currentTarget.style.filter=`drop-shadow(2px 2px 0 ${liked?"#c5330a":"#e03d0c44"})`;if(!liked)e.currentTarget.style.background="transparent";}}
          onMouseDown={e=>{e.stopPropagation();e.currentTarget.style.transform="translate(1px,1px)";e.currentTarget.style.filter=`drop-shadow(1px 1px 0 ${liked?"#c5330a":"#e03d0c44"})`;}}
          onMouseUp={e=>{e.stopPropagation();e.currentTarget.style.transform="translate(-1px,-1px)";}}>
          <span style={{fontSize:18,lineHeight:1,display:"inline-block",animation:heartAnim?"heartPop .42s cubic-bezier(.22,1,.36,1) both":"none"}}>{liked?"♥":"♡"}</span>
          <span style={{fontWeight:500}}>{(p.likes||0)>0?`${fmt.n(p.likes||0)} ${tr.lk}`:tr.lk}</span>
        </button>
        {onToggleLibrary&&<button onClick={(e)=>{e.stopPropagation();onToggleLibrary(p.id);}} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"8px 0",marginBottom:8,border:`2px solid ${inLibrary?"#16a34a":th.div}`,background:inLibrary?"#16a34a":"transparent",color:inLibrary?th.card:th.blk,cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,transition:"background .12s, border-color .12s"}}>{inLibrary?(lt?.saved||"✓ Saved"):(lt?.save||"+ Save")}</button>}
        <div style={{paddingTop:10,borderTop:`1px solid ${th.div}`}}>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.mut,marginBottom:8,lineHeight:1.55}}>
            {fmt.d(p.date)}{p.fileSize?` · ${fmt.b(p.fileSize)}`:""}<br/>
            {fmt.n(p.dl)} {tr.dl_n}
            {hasImages&&<span onClick={()=>onDetail(p)} style={{marginLeft:8,color:"#e03d0c",cursor:"pointer",textDecoration:"underline",fontSize:10}}>{(p.screenshots||[]).length+1} photo{((p.screenshots||[]).length+1)!==1?"s":""}</span>}
          </div>
          {customDlBtn ?? (
            hasBuilds(p) ? (<DownloadButtons prog={p} onDownload={onDownload} loadingDl={loadingDl} th={th} tr={tr}/>) : (<button onClick={handleDownloadClick} style={{width:"100%",padding:"10px 0",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,background:"#e03d0c",color:th.card,border:th.bdr,cursor:"pointer",letterSpacing:.5,...dlPress.btnStyle}} {...dlPress.handlers}>
              {loadingDl===p.id?tr.loading:((p.os||[]).includes("web")?tr.open:tr.dl)}
            </button>)
          )}
        </div>
      </div>
    </article>
  );
}// ── PART 2 — paste directly after Part 1 ──

const IDB_NAME  = "softvault";
const IDB_VER   = 1;
const IDB_STORE = "kv";

function openDB() {
  return new Promise((res, rej) => {
    if (typeof window === "undefined") { rej(new Error("ssr")); return; }
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
async function idbGet(key) {
  try {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx  = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => res(req.result ?? null);
      req.onerror   = () => rej(req.error);
    });
  } catch { return null; }
}
async function idbSet(key, value) {
  try {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx  = db.transaction(IDB_STORE, "readwrite");
      const req = tx.objectStore(IDB_STORE).put(value, key);
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  } catch {}
}

const ls = {
  get: (k) => { try { const v=localStorage.getItem(k); return v!=null?v:null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, String(v)); } catch {} },
};

function SecretLock({onClose}) {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [unlocked, setUnlocked]       = useState(false);
  useEffect(()=>{
    if(secondsLeft<=0){
      const id=requestAnimationFrame(()=>setUnlocked(true));
      return ()=>cancelAnimationFrame(id);
    }
    const t=setTimeout(()=>setSecondsLeft(s=>s-1),1000);
    return ()=>clearTimeout(t);
  },[secondsLeft]);
  return(
    <div
      onClick={unlocked?onClose:undefined}
      style={{
        position:"fixed",inset:0,zIndex:9001,
        cursor:unlocked?"pointer":"default",
        display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"flex-end",
        paddingBottom:28,
        pointerEvents:"all",
        background:"transparent",
      }}>
      <div style={{
        fontFamily:"'IBM Plex Mono',monospace",
        fontSize:11,letterSpacing:2,
        padding:"6px 16px",
        borderRadius:2,
        transition:"opacity .4s ease",
        opacity: unlocked ? 0.55 : 0.8,
        color: unlocked ? "#aaa" : "#888",
        background:"rgba(0,0,0,.35)",
        userSelect:"none",
      }}>
        {unlocked ? "click anywhere to close" : `closing in ${secondsLeft}s`}
      </div>
    </div>
  );
}

export default function Vault() {
  const [progs,setProgs]           = useState([]);
  const [likes,setLikes]           = useState([]);
  const [library,setLibraryState] = useState([]);
  const [myAppsOnly,setMyAppsOnly] = useState(false);
  const { user } = useAuth();
  useEffect(() => {
    if (!user) { setLikes([]); setLibraryState([]); return; }
    let active = true;
    fetchMyLikes(user.id).then((ids) => { if (active) setLikes(ids); });
    fetchMyLibrary(user.id).then((ids) => { if (active) setLibraryState(ids); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPartyUnlocked(false);
      setPartyMode(false);
      setPartySecret(false);
      return;
    }
    const unlocked = ls.get(partyUnlockedKey(user.id)) === "1";
    const enabled = ls.get(partyEnabledKey(user.id)) === "1";
    setPartyUnlocked(unlocked);
    if (unlocked && enabled) {
      setPartyMode(true);
      setPartySecret(true);
    } else {
      setPartyMode(false);
      setPartySecret(false);
    }
  }, [user]);

  const setUserPartyEnabled = (enabled) => {
    if (!user) return;
    setPartyUnlocked(true);
    setPartyMode(enabled);
    setPartySecret(enabled);
    ls.set(partyUnlockedKey(user.id), "1");
    ls.set(partyEnabledKey(user.id), enabled ? "1" : "0");
    ping(enabled ? "Party mode enabled" : "Party mode disabled", "ok");
  };

  // When auth state changes, re-check admin rights for the signed-in user.
  useEffect(() => {
    (async () => {
      if (!user) { setIsAdmin(false); setPage("home"); return; }
      try {
        const sess = await supabase.auth.getSession();
        const token = sess?.data?.session?.access_token || null;
        if (!token) return;
        const r = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const j = await r.json();
          setIsAdmin(!!j.authed);
          setHasAdmin(!!j.exists);
          if (j.authed) setPage("admin");
          if (j.adminEmail) setAdminEmail(j.adminEmail);
        }
      } catch (e) { /* ignore */ }
    })();
  }, [user]);
  const [sett,setSett]             = useState({ann:{text:"",type:"info",visible:false},support:{url:"",msg:"",visible:false},heroSub:"",secretDownloads:[],twoFactorEnabled:false});
  const [ready,setReady]           = useState(false);
  const [isDark,setIsDark]         = useState(false);
  const [lang,setLang]             = useState("en");
  const [hasAdmin,setHasAdmin]     = useState(false);
  const [isAdmin,setIsAdmin]       = useState(false);
  const [page,setPage]             = useState("home");
  const [adminTab,setAdminTab]     = useState("programs");
  const [modal,setModal]           = useState(null);
  const [detailProg,setDetailProg] = useState(null);
  const [search,setSearch]         = useState("");
  const [cat,setCat]               = useState("All");
  const [sort,setSort]             = useState("newest");
  const [osFilter,setOsFilter]     = useState([]);
  const [pw,setPw]                 = useState("");
  const [pw2,setPw2]               = useState("");
  const [curPw,setCurPw]           = useState("");
  const [resetStep,setResetStep]   = useState("request");
  const [resetCode,setResetCode]   = useState("");
  const [resetMsg,setResetMsg]     = useState("");
  const [resetErr,setResetErr]     = useState("");
  const [pwErr,setPwErr]           = useState("");
  const [form,setForm]             = useState({...BLANK,builds:freshBuilds()});
  const [uploadMode,setUploadMode] = useState("url");
  const [editId,setEditId]         = useState(null);
  const [editForm,setEditForm]     = useState({...BLANK});
  const [annDraft,setAnnDraft]     = useState({text:"",type:"info"});
  const [ppDraft,setPpDraft]       = useState({url:"",msg:"",visible:false});
  const [twoFactorEnabledDraft,setTwoFactorEnabledDraft] = useState(false);
  const [sdDraft,setSdDraft]       = useState(Array(12).fill(null).map(()=>({...BLANK_DL})));
  const [loadingDl,setLoadingDl]   = useState(null);
  const [busy,setBusy]             = useState(false);
  const [toast,setToast]           = useState(null);
  const [delId,setDelId]           = useState(null);
  const [uploadKey,setUploadKey]   = useState(0);
  const [isInitializing,setIsInitializing] = useState(true);

  const [secret1,setSecret1]   = useState(false);
  const [secret2,setSecret2]   = useState(false);
  const [secret3,setSecret3]   = useState(false);
  const [secret4,setSecret4]   = useState(false);
  const [secret5,setSecret5]   = useState(false);
  const [secret6,setSecret6]   = useState(false);
  const [secret7,setSecret7]   = useState(false);
  const [secret8,setSecret8]   = useState(false);
  const [secret9,setSecret9]   = useState(false);
  const [secret10,setSecret10] = useState(false);
  const [secret11,setSecret11] = useState(false);
  const [secret12,setSecret12] = useState(false);
  const [s7CardName,setS7CardName] = useState("");
  const [chargeProgress,setChargeProgress] = useState(0);

  const [partyMode,setPartyMode]   = useState(false);
  const [partySecret,setPartySecret] = useState(false);
  const [partyConfirm,setPartyConfirm] = useState(false);
  const [partyUnlocked,setPartyUnlocked] = useState(false);
  const [foundSecrets,setFoundSecrets] = useState([]);
  const [starAnim,setStarAnim]     = useState(null);
  const [allFoundModal,setAllFoundModal] = useState(false);
  const [finalSurge,setFinalSurge] = useState(false);
  const [glitchFeatureActive,setGlitchFeatureActive] = useState(false);
  const [postGlitch,setPostGlitch] = useState(false);
  const [hideCorruption,setHideCorruption] = useState(false);
  const [setupEmail,setSetupEmail] = useState("");
  const [loginOtp,setLoginOtp] = useState("");
  const [loginRequires2fa,setLoginRequires2fa] = useState(false);
  const [loginMessage,setLoginMessage] = useState("");
  const [adminEmail,setAdminEmail] = useState("");
  const [adminEmailDraft,setAdminEmailDraft] = useState("");
  const [termLines,setTermLines]   = useState([]);
  const [logoDisplay,setLogoDisplay] = useState("SoftwareVault");

  const foundRef       = useRef([]);
  const fileRef        = useRef();
  const konamiRef      = useRef(0);
  const typedRef       = useRef("");
  const logoClicksRef  = useRef(0);
  const logoTimerRef   = useRef(null);
  const scrambleRef    = useRef(null);
  const partyTimerRef  = useRef(null);
  const termTimerRef   = useRef(null);
  const statsClickRef  = useRef(0);
  const statsTimerRef  = useRef(null);
  const heroClickRef   = useRef(0);
  const heroTimerRef   = useRef(null);
  const footerClickRef = useRef(0);
  const footerTimerRef = useRef(null);
  const heroHoldRef      = useRef(false);
  const altHoverTimerRef = useRef(null);
  const holdTimerRef     = useRef(null);
  const holdIntervalRef  = useRef(null);
  const themeClickRef    = useRef(0);
  const themeTimerRef    = useRef(null);
  const featuredClickRef = useRef(0);
  const featuredTimerRef = useRef(null);

  const tr=TR[lang]||TR.en;
  // The chosen accent has to reach the theme object: nearly every button colours
  // itself from th.org, so a CSS variable alone would never show up.
  const [accent,setAccent]=useState("#e03d0c");
  useEffect(()=>{
    const read=()=>{ const a=loadAppearance(); applyAppearance(a); setAccent(a.accent); };
    read();
    window.addEventListener("vault-appearance",read);
    return ()=>window.removeEventListener("vault-appearance",read);
  },[]);
  const baseTh=isDark?THEMES.dark:THEMES.light;
  const th=useMemo(()=>({...baseTh,org:accent}),[baseTh,accent]);
  const lt = libT(lang);
  const gridKey=`${cat}|${sort}|${osFilter.join(",")}|${search}`;
  const ping=(msg,type="ok")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  useEffect(()=>{
    if(!document.querySelector("meta[name='darkreader-lock']")){
      const m=document.createElement("meta");
      m.name="darkreader-lock"; document.head.appendChild(m);
    }
    let cs=document.querySelector("meta[name='color-scheme']");
    if(!cs){cs=document.createElement("meta");cs.name="color-scheme";document.head.appendChild(cs);}
    cs.content=isDark?"dark":"light";
    document.documentElement.style.colorScheme=isDark?"dark":"light";
    document.documentElement.setAttribute("data-theme",isDark?"dark":"light");
  },[isDark]);

  useEffect(()=>{
    document.title="SoftwareVault";
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="none" stroke="#e03d0c" stroke-width="2.5"/><circle cx="16" cy="16" r="9" fill="none" stroke="#e03d0c" stroke-width="1.5"/><circle cx="16" cy="16" r="3" fill="#e03d0c"/><line x1="16" y1="7" x2="16" y2="11" stroke="#e03d0c" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="21" x2="16" y2="25" stroke="#e03d0c" stroke-width="2" stroke-linecap="round"/><line x1="7" y1="16" x2="11" y2="16" stroke="#e03d0c" stroke-width="2" stroke-linecap="round"/><line x1="21" y1="16" x2="25" y2="16" stroke="#e03d0c" stroke-width="2" stroke-linecap="round"/></svg>`;
    const encoded="data:image/svg+xml,"+encodeURIComponent(svg);
    let link=document.querySelector("link[rel*='icon']");
    if(!link){link=document.createElement("link");link.rel="icon";document.head.appendChild(link);}
    link.type="image/svg+xml"; link.href=encoded;
  },[]);

  useEffect(()=>{
    (async()=>{
      try {
        // check server for admin existence / auth
        try {
          const sess = await supabase.auth.getSession();
          const token = sess?.data?.session?.access_token || null;
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const r = await fetch('/api/admin', { headers });
          if (r.ok) {
            const j = await r.json();
            setHasAdmin(!!j.exists);
            if (j.authed) { setIsAdmin(true); }
            if (j.adminEmail) setAdminEmail(j.adminEmail);
          }
        } catch (e) { /* ignore */ }

        // Try to load programs from Supabase first
        let loadedProgs = null;
        let supabaseLoaded = false;
        try {
          const r = await fetch('/api/programs');
          if (r.ok) {
            const j = await r.json();
            loadedProgs = j.programs || [];
            supabaseLoaded = true;
          }
        } catch (e) {
          console.warn("Could not load from Supabase:", e);
        }

        // Only fall back to IndexedDB if Supabase load failed AND IndexedDB has data
        if (!supabaseLoaded || (loadedProgs && loadedProgs.length === 0)) {
          const idbProgs = await idbGet(K.progs);
          if (idbProgs && idbProgs.length > 0) {
            loadedProgs = idbProgs;
          }
        }

        if(loadedProgs) setProgs(loadedProgs);

        const savedSett=await idbGet(K.sett);
        if(savedSett){
          setSett(savedSett);
          setAnnDraft({text:savedSett.ann?.text||"",type:savedSett.ann?.type||"info"});
          setPpDraft({url:savedSett.support?.url||"",msg:savedSett.support?.msg||"",visible:savedSett.support?.visible||false});
          setTwoFactorEnabledDraft(savedSett.twoFactorEnabled||false);
          const dls=Array(12).fill(null).map((_,i)=>savedSett.secretDownloads?.[i]||{...BLANK_DL});
          setSdDraft(dls);
        }
        const dk=ls.get(K.dark);
        if(dk!==null){ setIsDark(JSON.parse(dk)); }
        else { setIsDark(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false); }
        const lg=ls.get(K.lang); if(lg) setLang(lg.replace(/"/g,""));
        /* likes now load per-account from the DB — see the useAuth effect */
        const fd=ls.get(K.found); if(fd){const f=JSON.parse(fd);foundRef.current=f;setFoundSecrets(f);}
      } catch(e){ console.error("Storage load error:",e); }
      setReady(true);
      setTimeout(()=>setIsInitializing(false), 600);
    })();
  },[]);

  useEffect(()=>{ if(ready) ls.set(K.dark,JSON.stringify(isDark)); },[isDark,ready]);
  useEffect(()=>{ if(ready) ls.set(K.lang,lang); },[lang,ready]);
  useEffect(()=>{
    if(typeof document === "undefined") return;
    for(let i=0;i<=10;i++) document.documentElement.classList.remove(`corrupt-lvl-${i}`);
    if(!hideCorruption && foundSecrets.length > 0){
      const lvl = Math.min(12, foundSecrets.length);
      document.documentElement.classList.add(`corrupt-lvl-${lvl}`);
    }
  },[foundSecrets, hideCorruption]);

  useEffect(()=>{
    const secretStates=[secret1,secret2,secret3,secret4,secret5,secret6,secret7,secret8,secret9,secret10,secret11,secret12];
    secretStates.forEach((val,idx)=>{
      const cls = `secret-${idx+1}`;
      if(val) document.documentElement.classList.add(cls);
      else document.documentElement.classList.remove(cls);
    });
    if(partySecret) document.documentElement.classList.add('party-active');
    else document.documentElement.classList.remove('party-active');
  },[secret1,secret2,secret3,secret4,secret5,secret6,secret7,secret8,secret9,secret10,secret11,secret12,partySecret]);

  const markSecretFound=async(n)=>{
    if(foundRef.current.includes(n)) return;
    const nf=[...foundRef.current,n];
    foundRef.current=nf; setFoundSecrets(nf);
    setStarAnim(n); setTimeout(()=>setStarAnim(null),1800);
    await Promise.resolve(ls.set(K.found,JSON.stringify(nf)));
    if(nf.length===12) setTimeout(()=>setAllFoundModal(true),2600);
  };

  const resetCorruption = async ()=>{
    foundRef.current = [];
    setFoundSecrets([]);
    setHideCorruption(false);
    setGlitchFeatureActive(false);
    setPostGlitch(false);
    setFinalSurge(false);
    setPartyMode(false);
    setPartySecret(false);
    setPartyConfirm(false);
    setStarAnim(null);
    setChargeProgress(0);
    setSecret1(false); setSecret2(false); setSecret3(false); setSecret4(false);
    setSecret5(false); setSecret6(false); setSecret7(false); setSecret8(false);
    setSecret9(false); setSecret10(false); setSecret11(false); setSecret12(false);
    await Promise.resolve(ls.set(K.found,JSON.stringify([])));
    ping("Corruption reset. All secrets are cleared.");
  };

  useEffect(()=>{
    if(foundSecrets.length===12 && !glitchFeatureActive){
      setHideCorruption(false);
      setFinalSurge(true);
      setTimeout(()=>{
        setFinalSurge(false);
        setGlitchFeatureActive(true);
        setPostGlitch(true);
        ping("The vault finally gave up. A hidden featured payload surfaced.");
      },2200);
    }
  },[foundSecrets.length, glitchFeatureActive]);

  useEffect(()=>{
    const SEQ=["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight"];
    const handle=(e)=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.tagName==="SELECT") return;
      if(SEQ[konamiRef.current]===e.key){
        konamiRef.current++;
        if(konamiRef.current===SEQ.length){
          konamiRef.current=0; setSecret1(true); markSecretFound(1); setTimeout(()=>setSecret1(false),14000);
        }
      } else { konamiRef.current=e.key===SEQ[0]?1:0; }
      if(e.key.length===1&&!e.ctrlKey&&!e.metaKey){
        typedRef.current=(typedRef.current+e.key.toLowerCase()).slice(-8);
        if(typedRef.current.includes("open")){
          typedRef.current=""; setSecret4(true); markSecretFound(4); setTimeout(()=>setSecret4(false),12000);
        }
      }
    };
    document.addEventListener("keydown",handle);
    return ()=>document.removeEventListener("keydown",handle);
  },[]);

  const handleSearchKeyDown=(e)=>{
    if(e.key==="Enter" && search.trim().toLowerCase()==="debug" && !foundSecrets.includes(8)){
      setSecret8(true); markSecretFound(8); setTimeout(()=>setSecret8(false),14000);
    }
  };

  const handleThemeToggle=(e)=>{
    if(e?.shiftKey && !foundSecrets.includes(9)){
      setSecret9(true); markSecretFound(9); setTimeout(()=>setSecret9(false),14000);
    }
    setIsDark(d=>!d);
    themeClickRef.current++;
    clearTimeout(themeTimerRef.current);
    if(themeClickRef.current>=10){
      themeClickRef.current=0;
      setSecret10(true); markSecretFound(10); setTimeout(()=>setSecret10(false),12000);
    } else {
      themeTimerRef.current=setTimeout(()=>{themeClickRef.current=0;},3000);
    }
  };

  const handleFeaturedClick=(e)=>{
    e.stopPropagation();
    if(foundSecrets.includes(12)) return;
    featuredClickRef.current++;
    clearTimeout(featuredTimerRef.current);
    if(featuredClickRef.current>=7){
      featuredClickRef.current=0;
      setSecret12(true); markSecretFound(12); setTimeout(()=>setSecret12(false),12000);
    } else {
      featuredTimerRef.current=setTimeout(()=>{featuredClickRef.current=0;},2000);
    }
  };

  useEffect(()=>{
    if(!secret1){setTermLines([]);clearInterval(termTimerRef.current);return;}
    const LINES=["VAULT_OS v1.0.0 — BOOT SEQUENCE","────────────────────────────────────","> scanning for intrusion vectors...","> THREAT IDENTIFIED: ↑↑↓↓←→←→","> source: HUMAN / CURIOUS","> threat level: NON-HOSTILE","> granting maximum clearance...","","> ── CLASSIFIED BROADCAST ──────────","","  circles demand repetition.","  some symbols were made to be pressed.","  not once. not in haste.","  but in a rhythm. in a pattern.","","  the vault shows what seekers know to find.","  there is a marked thing at the top.","","> — v","","> CHANNEL CLOSING IN 5..."];
    let i=0; clearInterval(termTimerRef.current);
    termTimerRef.current=setInterval(()=>{
      if(i<LINES.length){setTermLines(p=>[...p,LINES[i]]);i++;}
      else clearInterval(termTimerRef.current);
    },150);
    return ()=>clearInterval(termTimerRef.current);
  },[secret1]);

  const GLITCH="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^";
  const handleLogoClick=()=>{
    setPage("home"); setIsAdmin(false);
    logoClicksRef.current++;
    clearTimeout(logoTimerRef.current);
    if(logoClicksRef.current>=5){
      logoClicksRef.current=0;
      clearInterval(scrambleRef.current); let ticks=0;
      scrambleRef.current=setInterval(()=>{
        ticks++;
        setLogoDisplay(Array.from("SoftwareVault").map(()=>GLITCH[Math.floor(Math.random()*GLITCH.length)]).join(""));
        if(ticks>=18){clearInterval(scrambleRef.current);setLogoDisplay("SoftwareVault");setSecret2(true);markSecretFound(2);setTimeout(()=>setSecret2(false),12000);}
      },50);
    } else { logoTimerRef.current=setTimeout(()=>{logoClicksRef.current=0;},1300); }
  };

  const handleHeroTitleDown=()=>{
    heroHoldRef.current=true;
    heroTimerRef.current=setTimeout(()=>{
      if(heroHoldRef.current){
        setSecret3(true); markSecretFound(3); setTimeout(()=>setSecret3(false),10000);
      }
    },1200);
  };
  const handleHeroTitleUp=()=>{
    heroHoldRef.current=false;
    clearTimeout(heroTimerRef.current);
  };

  const handleFooterYearClick=()=>{
    footerClickRef.current++;
    clearTimeout(footerTimerRef.current);
    if(footerClickRef.current>=5){
      footerClickRef.current=0;
      setPartyConfirm(true);
    } else footerTimerRef.current=setTimeout(()=>{footerClickRef.current=0;},1200);
  };

  const handleFooterVaultMove=(e)=>{
    if(e.altKey){
      if(altHoverTimerRef.current) return;
      altHoverTimerRef.current=setTimeout(()=>{
        setSecret6(true); markSecretFound(6); setTimeout(()=>setSecret6(false),8000);
      },2500);
    } else {
      clearTimeout(altHoverTimerRef.current);
      altHoverTimerRef.current=null;
    }
  };
  const handleFooterVaultLeave=()=>{
    clearTimeout(altHoverTimerRef.current);
    altHoverTimerRef.current=null;
  };

  const handleStatsClick=()=>{
    statsClickRef.current++;
    clearTimeout(statsTimerRef.current);
    if(statsClickRef.current>=5){statsClickRef.current=0;setSecret5(true);markSecretFound(5);setTimeout(()=>setSecret5(false),12000);}
    else statsTimerRef.current=setTimeout(()=>{statsClickRef.current=0;},1500);
  };

  // /api/programs and /api/upload are admin-only now (they used to accept
  // anonymous writes), so every call has to carry the caller's access token.
  const authHeaders=async(extra={})=>{
    try{
      const sess=await supabase.auth.getSession();
      const token=sess?.data?.session?.access_token;
      return token?{...extra,Authorization:`Bearer ${token}`}:extra;
    }catch{return extra;}
  };

  const saveProgs=async l=>{
    try{
      await idbSet(K.progs,l);
      setProgs(l);
      // Sync to Supabase - wait for it to complete
      try {
        const res = await fetch('/api/programs', {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ programs: l }),
        });
        if (!res.ok) {
          console.error("Failed to sync to Supabase:", res.status, await res.text());
        }
      } catch(e) {
        console.error("Failed to sync programs to server:", e);
      }
    }catch(e){
      console.error("Failed to save programs:",e);
    }
  };
  const saveSett =async s=>{ try{await idbSet(K.sett,s);setSett(s);}catch(e){console.error("Failed to save settings:",e);} };
  const saveSecretDownload=async(idx)=>{
    const s={...sett,secretDownloads:[...sdDraft]};
    await saveSett(s); ping(`Secret #${idx+1} saved.`);
  };
  const updateSd=(idx,field,value)=>setSdDraft(d=>{const a=[...d];a[idx]={...a[idx],[field]:value};return a;});

  const closeModal=()=>{
    setModal(null);
    setPw("");setCurPw("");
    setPw2("");
    setPwErr("");
    setLoginOtp("");
    setLoginRequires2fa(false);
    setLoginMessage("");
    setSetupEmail("");
  };

  // dialogs: only a genuine click on the backdrop closes them, and the page
  // behind stays where it is while one is open
  const modalBackdrop = useBackdropClose(closeModal);
  useScrollLock(!!modal);

  const login=async()=>{
    setPwErr("");
    // Admins now sign in via Supabase auth; open the sign-in modal.
    openAuthModal();
    ping('Sign in with your account to access admin (if you are an admin).');
  };
  const setupAdmin=async()=>{
    setPwErr("");
    try{
      const sess = await supabase.auth.getSession();
      const token = sess?.data?.session?.access_token;
      if(!token){ setPwErr("Sign in first"); openAuthModal(); return; }
      const r = await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json', Authorization: `Bearer ${token}`},body:JSON.stringify({action:'setup'})});
      const j = await r.json();
      if(r.ok && j.ok){ setHasAdmin(true); setIsAdmin(true); setPage('admin'); setAdminTab('programs'); setModal(null); setPw(''); setPw2(''); setSetupEmail(''); ping("You're in."); }
      else setPwErr(j.error||"Couldn't set up admin.");
    }catch(e){ setPwErr("Couldn't set up admin."); }
  };
  const changePw=async()=>{
    ping('Password management moved to Supabase auth. Use your account settings.','err');
  };
  const requestReset=async()=>{
    ping('Password reset moved to Supabase auth. Use your account recovery flow.','err');
  };
  const confirmReset=async()=>{
    ping('Password reset moved to Supabase auth. Use your account recovery flow.','err');
  };

  const processCoverImage=async(file)=>{try{return await compressImage(file,900,0.80);}catch{return null;}};
  const processScreenshot=async(file)=>{try{return await compressImage(file,1100,0.80);}catch{return null;}};

  const upload=async()=>{
    if(!form.name.trim()){ping("Give it a name.","err");return;}
    setBusy(true);
    try{
      const downloads={};
      for(const o of ["win","mac","lin"]){
        const b=(form.builds||{})[o]||{};
        if(b.file){
          if(b.file.size>50_000_000){ping(o+": over 50 MB — paste a URL instead.","err");setBusy(false);return;}
          const fd=new FormData();fd.append("file",b.file);fd.append("fileName",b.file.name);fd.append("fileSize",b.file.size);
          const res=await fetch("/api/upload",{method:"POST",headers:await authHeaders(),body:fd});
          if(!res.ok){const e=await res.json().catch(()=>({}));ping(e.error||(o+": upload failed"),"err");setBusy(false);return;}
          const data=await res.json();
          downloads[o]={url:data.url,name:data.fileName,size:data.fileSize};
        }else if((b.url||"").trim()){
          const u=b.url.trim();downloads[o]={url:u,name:(u.split("/").pop()||form.name.trim()),size:null};
        }
      }
      const webUrl=(form.url||"").trim();
      const osTags=Object.keys(downloads);if(webUrl)osTags.push("web");
      const p={id:Date.now().toString(),name:form.name.trim(),desc:form.desc.trim(),ver:form.ver||"1.0",cat:form.cat,os:osTags,featured:false,likes:0,url:webUrl||null,downloads,fileUrl:null,fileName:null,fileSize:null,coverImage:form.coverImage||null,screenshots:form.screenshots||[],date:new Date().toISOString(),dl:0};
      await saveProgs([...progs,p]);
      setForm({...BLANK,builds:freshBuilds()});
      setUploadKey(k=>k+1); ping("Added.");
    }catch{ping("Something went wrong.","err");}
    setBusy(false);
  };
  const saveEdit=async()=>{
    if(!editForm.name.trim()){ping("Name required.","err");return;}
    setBusy(true);
    try{
      const downloads={...(editForm.downloads||{})};
      for(const o of ["win","mac","lin"]){
        const b=(editForm.builds||{})[o]||{};
        if(b.remove){ delete downloads[o]; continue; }
        if(b.file){
          if(b.file.size>50_000_000){ping(o+": over 50 MB — paste a URL instead.","err");return;}
          const fd=new FormData();fd.append("file",b.file);fd.append("fileName",b.file.name);fd.append("fileSize",b.file.size);
          const res=await fetch("/api/upload",{method:"POST",headers:await authHeaders(),body:fd});
          if(!res.ok){const e=await res.json().catch(()=>({}));ping(e.error||(o+": upload failed"),"err");return;}
          const data=await res.json();
          downloads[o]={url:data.url,name:data.fileName,size:data.fileSize};
        }else if((b.url||"").trim()){
          const u=b.url.trim();downloads[o]={url:u,name:(u.split("/").pop()||editForm.name.trim()),size:null};
        }
      }
      const hasUrl=!!(editForm.url||"").trim();
      const dlKeys=Object.keys(downloads);
      let os = dlKeys.length>0 ? [...dlKeys] : (editForm.os||[]).filter(x=>x!=="web");
      if(hasUrl && !os.includes("web")) os.push("web");
      const u=progs.map(p=>p.id===editId?{...p,name:editForm.name.trim(),desc:editForm.desc.trim(),ver:editForm.ver,cat:editForm.cat,os,url:hasUrl?editForm.url.trim():null,downloads,coverImage:editForm.coverImage!==undefined?editForm.coverImage:p.coverImage,screenshots:editForm.screenshots||p.screenshots||[]}:p);
      await saveProgs(u); setModal(null); setEditId(null); ping("Saved.");
    }catch(e){ ping("Save failed.","err"); }
    finally{ setBusy(false); }
  };
  const toggleFeatured=async id=>{const u=progs.map(p=>p.id===id?{...p,featured:!p.featured}:p);await saveProgs(u);const updated=u.find(p=>p.id===id);ping(updated?.featured?"Pinned.":"Unpinned.");};
  const remove=async id=>{await saveProgs(progs.filter(p=>p.id!==id));setDelId(null);ping("Removed.");};
  const download=async(prog,target=null)=>{
    setLoadingDl(prog.id);
    // Count it via the tiny dedicated endpoint. The old path POSTed the ENTIRE
    // programs array back, which raced with other visitors and required write
    // access to every row (see /api/downloads + MIGRATION_DOWNLOAD_COUNTER.sql).
    setProgs(ps=>ps.map(p=>p.id===prog.id?{...p,dl:(p.dl||0)+1}:p));
    fetch("/api/downloads",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({programId:prog.id})}).catch(()=>{});
    const t=target&&prog.downloads?prog.downloads[target]:null;
    if(t&&t.url){const a=document.createElement("a");a.href=`/api/download?url=${encodeURIComponent(t.url)}&name=${encodeURIComponent(t.name||prog.name)}`;a.download=t.name||prog.name;a.click();}
    else if((prog.os||[]).includes("web")) window.open(prog.url||"https://softwarevault.dev","_blank");
    else if(prog.url) window.open(prog.url,"_blank");
    else if(prog.fileUrl){const a=document.createElement("a");a.href=`/api/download?url=${encodeURIComponent(prog.fileUrl)}&name=${encodeURIComponent(prog.fileName||prog.name)}`;a.download=prog.fileName||prog.name;a.click();}
    else if(prog.fileData){const a=document.createElement("a");a.href=prog.fileData;a.download=prog.fileName||prog.name;a.click();}
    setLoadingDl(null);
    if(detailProg?.id===prog.id) setDetailProg({...detailProg,dl:(detailProg.dl||0)+1});
  };
  const handleLike=async id=>{
    if(!user){ ping(likeHint(lang),"err"); openAuthModal(); return; }
    const had=likes.includes(id);
    const nl=had?likes.filter(x=>x!==id):[...likes,id];
    const np=progs.map(p=>p.id===id?{...p,likes:Math.max(0,(p.likes||0)+(had?-1:1))}:p);
    setLikes(nl); setProgs(np);
    if(detailProg?.id===id) setDetailProg(np.find(p=>p.id===id));
    try{ await setLike(user.id,id,!had); }
    catch{ setLikes(likes); setProgs(progs); if(detailProg?.id===id) setDetailProg(progs.find(p=>p.id===id)); ping("Couldn't save your like.","err"); }
  };

  const handleToggleLibrary=async id=>{
    if(!user){ ping(lt.hint,"err"); openAuthModal(); return; }
    const had=library.includes(id);
    const nl=had?library.filter(x=>x!==id):[...library,id];
    setLibraryState(nl);
    try{ await setLibrary(user.id,id,!had); ping(had?"Removed from My Apps.":"Saved to My Apps."); }
    catch{ setLibraryState(library); ping("Couldn't update My Apps.","err"); }
  };
  const saveAnn=async()=>{const s={...sett,ann:{...annDraft,visible:true}};await saveSett(s);ping("Saved.");};
  const clearAnn=async()=>{const s={...sett,ann:{text:"",type:"info",visible:false}};await saveSett(s);setAnnDraft({text:"",type:"info"});ping("Cleared.");};
  const saveSupport=async()=>{const s={...sett,support:{...ppDraft}};await saveSett(s);ping("Saved.");};
  const saveTwoFactorSetting=async()=>{
    ping('Two-factor settings are managed via Supabase auth. This action is unsupported here.','err');
  };
  const saveAdminEmail=async()=>{
    if(!adminEmailDraft||!adminEmailDraft.includes("@")){ping("Enter a valid email.","err");return;}
    try{
      const sess = await supabase.auth.getSession();
      const token = sess?.data?.session?.access_token || null;
      if(!token){ ping('Sign in as admin to set the admin email.','err'); openAuthModal(); return; }
      const r=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json', Authorization: `Bearer ${token}`},body:JSON.stringify({action:'set_email',email:adminEmailDraft})});
      const j = await r.json();
      if(r.ok && j.ok){
        // refresh masked email from server
        try{const g=await fetch('/api/admin',{headers:{Authorization:`Bearer ${token}`}}); if(g.ok){const gj=await g.json(); if(gj.adminEmail) setAdminEmail(gj.adminEmail);} }catch{}
        setAdminEmailDraft(""); ping('Admin email updated.');
      } else {
        console.error("Email save failed:", r.status, j);
        ping(j.error||'Could not set email','err');
      }
    }catch(e){console.error("Email save error:", e);ping('Request failed','err');}
  };
  const sendTestEmail=async()=>{
    if(!adminEmailDraft){ping("Enter an email address first.","err");return;}
    try{
      setBusy(true);
      const sess = await supabase.auth.getSession();
      const token = sess?.data?.session?.access_token || null;
      if(!token){ ping('Sign in as admin to send test emails.','err'); setBusy(false); openAuthModal(); return; }
      const r=await fetch('/api/test-email',{method:'POST',headers:{'Content-Type':'application/json', Authorization: `Bearer ${token}`},body:JSON.stringify({email:adminEmailDraft})});
      const j=await r.json();
      if(r.ok && j.ok){ ping('Test email sent.'); }
      else{ ping(j.error||'Could not send test email','err'); }
    }catch(e){ console.error('Test email error:', e); ping('Request failed','err'); }
    finally{ setBusy(false); }
  };

  let vis=[...progs].filter(p=>{
    const mc=cat==="All"||p.cat===cat;
    const ms=!search||p.name.toLowerCase().includes(search.toLowerCase())||(p.desc||"").toLowerCase().includes(search.toLowerCase());
    const mo=osFilter.length===0||osFilter.some(o=>(p.os||[]).includes(o));
    const ml=!myAppsOnly||library.includes(p.id); return mc&&ms&&mo&&ml;
  });
  if(sort==="popular") vis.sort((a,b)=>(b.dl||0)-(a.dl||0));
  else if(sort==="az") vis.sort((a,b)=>a.name.localeCompare(b.name));
  else vis.sort((a,b)=>new Date(b.date)-new Date(a.date));
  const getSd=(n)=>sett.secretDownloads?.[n-1];
  const hiddenSecret10 = getSd(10);
  const glitchFeaturedCard = glitchFeatureActive && !hideCorruption && hiddenSecret10?.enabled && hiddenSecret10?.name && hiddenSecret10?.url ? {
    id:"secret-glitch-card",
    name:hiddenSecret10.name,
    desc:hiddenSecret10.desc||"A corrupted payload surfaced in featured.",
    ver:"0.9",
    cat:"Corruption",
    os:[],
    featured:true,
    likes:0,
    url:hiddenSecret10.url,
    fileName:hiddenSecret10.name,
    fileSize:null,
    coverImage:null,
    screenshots:[],
    date:new Date().toISOString(),
    dl:0,
  } : null;
  const featVis=[...vis.filter(p=>p.featured), ...(glitchFeaturedCard?[glitchFeaturedCard]:[])];
  const regVis=vis.filter(p=>!p.featured);
  const totalDl=progs.reduce((a,p)=>a+(p.dl||0),0);
  const topProg=[...progs].sort((a,b)=>(b.dl||0)-(a.dl||0))[0];
  const corruptionLevel = foundSecrets.length;
  const corruptionLabel = corruptionLevel === 0 ? "stable" : corruptionLevel < 3 ? "frayed" : corruptionLevel < 5 ? "glitched" : corruptionLevel < 8 ? "fractured" : corruptionLevel < 10 ? "severed" : corruptionLevel < 12 ? "shattered" : "destroyed";
  const corruptionColor = corruptionLevel === 0 ? "#4ade80" : corruptionLevel < 3 ? "#facc15" : corruptionLevel < 5 ? "#fb923c" : corruptionLevel < 8 ? "#fb7185" : corruptionLevel < 10 ? "#dc2626" : corruptionLevel < 12 ? "#7c2d12" : "#1f1f1f";
  const ann=sett.ann||{}, sup=sett.support||{}, annC=th.annC[ann.type]||th.annC.info;

  const inp={width:"100%",padding:"10px 12px",border:th.bdr,background:th.inputBg,color:th.blk,fontFamily:"'IBM Plex Mono',monospace",fontSize:13,outline:"none",boxSizing:"border-box",transition:"all .2s ease"};
  const lbl={fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.mut,display:"block",marginBottom:6};
  const baseBtn=(active=false)=>({border:th.bdr,background:active?th.blk:th.card,color:active?th.card:th.blk,padding:"7px 12px",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,cursor:"pointer",filter:`drop-shadow(4px 4px 0 ${th.sh2.split(" ").slice(3).join(" ")})`,transition:"all .18s ease",fontWeight:active?600:400});

  const CardWithSecrets=({p,...rest})=>(
    <ProgramCard p={p} {...rest} corruptionLevel={corruptionLevel} onTitleHold={(prog)=>{ setS7CardName(prog.name); setSecret7(true); markSecretFound(7); setTimeout(()=>setSecret7(false),14000); }} onContextMenu={(prog)=>{ setSecret11(true); markSecretFound(11); setTimeout(()=>setSecret11(false),12000); }} onFeaturedClick={handleFeaturedClick} customDlBtn={<ChargeDownloadBtn prog={p}/>}/>
  );

  const ChargeDownloadBtn=({prog})=>{
    const [charge,setCharge]=useState(0);
    const [charging,setCharging]=useState(false);
    const holdTimer   = useRef(null);
    const holdInterval= useRef(null);
    const didCharge   = useRef(false);
    const shColor = th.sh2.split(" ").slice(3).join(" ");
    const startHold=(e)=>{
      e.preventDefault();
      didCharge.current=false;
      setCharging(true);
      let elapsed=0;
      holdInterval.current=setInterval(()=>{
        elapsed+=50;
        const pct=Math.min(100,Math.round((elapsed/2000)*100));
        setCharge(pct);
        if(pct>=100){
          clearInterval(holdInterval.current);
          didCharge.current=true;
          setCharge(0); setCharging(false);
          setSecret9(true); markSecretFound(9); setTimeout(()=>setSecret9(false),14000);
          setTimeout(()=>download(prog),400);
        }
      },50);
    };
    const endHold=()=>{
      clearTimeout(holdTimer.current);
      clearInterval(holdInterval.current);
      setCharge(0); setCharging(false);
      if(!didCharge.current) download(prog);
      didCharge.current=false;
    };
    const cancelHold=()=>{
      clearTimeout(holdTimer.current);
      clearInterval(holdInterval.current);
      setCharge(0); setCharging(false);
      didCharge.current=false;
    };
    return(
      <div style={{position:"relative",width:"100%",userSelect:"none"}}>
        {charging&&charge>0&&(
          <div style={{position:"absolute",top:0,left:0,height:"100%",width:`${charge}%`,
            background:"rgba(255,255,255,.25)",pointerEvents:"none",zIndex:1,
            transition:"width .04s linear"}}/>
        )}
        <button
          onMouseDown={startHold}
          onMouseUp={endHold}
          onMouseLeave={cancelHold}
          onTouchStart={startHold}
          onTouchEnd={endHold}
          style={{width:"100%",padding:"10px 0",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,
            background:"#e03d0c",color:th.card,border:th.bdr,cursor:"pointer",letterSpacing:.5,
            position:"relative",overflow:"hidden",
            filter:`drop-shadow(3px 3px 0 ${shColor})`,
            transition:"filter 0.1s ease, transform 0.1s ease"}}
          onMouseEnter={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";e.currentTarget.style.filter=`drop-shadow(4px 4px 0 ${shColor})`;}}
        >
          {loadingDl===prog.id ? tr.loading : charging&&charge>0 ? `${charge}%` : tr.dl}
        </button>
      </div>
    );
  };

  return(
    <div id="sv-root" className={postGlitch?"glitchy":""} style={{position:"relative",minHeight:"100vh",overflow:"hidden",background:th.bg,color:th.blk,fontFamily:"'IBM Plex Mono','Courier New',monospace",animation:partyMode?"partyShift .65s linear infinite":"none"}}>
      {isInitializing&&(
        <div style={{position:"fixed",inset:0,background:`linear-gradient(135deg, ${th.bg} 0%, ${th.card} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,animation:"fadein .4s ease, fadeout .5s ease 0.5s forwards",overflow:"hidden",pointerEvents:"none"}}>
          <div style={{position:"absolute",inset:0}}>
            <div style={{position:"absolute",top:"15%",right:"15%",width:250,height:250,background:"radial-gradient(circle, #e03d0c 0%, transparent 70%)",opacity:0.08,borderRadius:"50%",filter:"blur(50px)"}}/>
            <div style={{position:"absolute",bottom:"15%",left:"10%",width:180,height:180,background:"radial-gradient(circle, #e03d0c 0%, transparent 70%)",opacity:0.05,borderRadius:"50%",filter:"blur(40px)"}}/>
          </div>
          <div style={{textAlign:"center",position:"relative",zIndex:1}}>
            <div style={{marginBottom:32,position:"relative",display:"flex",justifyContent:"center",alignItems:"center"}}>
              <svg width="100" height="100" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{animation:"spinLoader 2s linear infinite"}}>
                <defs>
                  <filter id="glow-load">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <circle cx="16" cy="16" r="14.5" stroke="#e03d0c" strokeWidth="2.5" opacity="0.9"/>
                <circle cx="16" cy="16" r="10" stroke={th.blk} strokeWidth="1" opacity="0.2"/>
                <circle cx="16" cy="16" r="3.5" fill="#e03d0c" filter="url(#glow-load)"/>
                <line x1="16" y1="5" x2="16" y2="10.5" stroke="#e03d0c" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
                <line x1="16" y1="21.5" x2="16" y2="27" stroke="#e03d0c" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
                <line x1="5" y1="16" x2="10.5" y2="16" stroke="#e03d0c" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
                <line x1="21.5" y1="16" x2="27" y2="16" stroke="#e03d0c" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
                <circle cx="16" cy="4.5" r="1.8" fill="#e03d0c" opacity="0.7"/>
                <circle cx="27.5" cy="16" r="1.8" fill="#e03d0c" opacity="0.5"/>
                <circle cx="4.5" cy="16" r="1.8" fill="#e03d0c" opacity="0.5"/>
              </svg>
            </div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:36,color:th.blk,marginBottom:8,letterSpacing:1,fontWeight:600}}>VAULT</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.mut,letterSpacing:2.5,marginBottom:28,textTransform:"uppercase"}}>Loading...</div>
            <div style={{display:"flex",gap:12,justifyContent:"center"}}>
              {[0,1,2].map(i=><div key={i} style={{width:9,height:9,borderRadius:"50%",background:"#e03d0c",animation:`pulseLoader 1.4s ease-in-out infinite`,animationDelay:`${i*0.25}s`}}/>)}
            </div>
          </div>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@400;500&display=swap');
        :root { color-scheme: ${isDark?"dark":"light"} !important; }
        #sv-root { background-color: ${th.bg} !important; color: ${th.blk} !important; }
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:#aaa}
        @keyframes heroReveal{from{transform:translateY(108%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
        @keyframes heartPop{0%{transform:scale(1)}30%{transform:scale(1.55)}65%{transform:scale(.88)}100%{transform:scale(1)}}
        @keyframes statSlide{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes annSlide{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes annMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes modalIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
        @keyframes emptyPulse{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes partyShift{0%{filter:hue-rotate(0deg) saturate(1.8)}100%{filter:hue-rotate(360deg) saturate(1.8)}}
        @keyframes featPulse{0%,100%{box-shadow:4px 4px 0 #111}50%{box-shadow:4px 4px 0 #111,0 0 22px rgba(229,64,14,.25)}}
        @keyframes vaultGlow{0%,100%{text-shadow:0 0 10px rgba(200,168,75,.5),0 0 30px rgba(200,168,75,.2)}50%{text-shadow:0 0 24px rgba(200,168,75,.9),0 0 60px rgba(200,168,75,.4)}}
        @keyframes vaultReveal{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:none}}
        @keyframes crtScan{0%{top:-20%}100%{top:120%}}
        @keyframes glitch1{0%,88%,100%{clip-path:inset(60% 0 30% 0);transform:translateX(0)}89%{clip-path:inset(10% 0 70% 0);transform:translateX(4px)}94%{clip-path:inset(40% 0 45% 0);transform:translateX(-3px)}}
        @keyframes glitch2{0%,78%,100%{clip-path:inset(30% 0 50% 0);transform:translateX(0)}79%{clip-path:inset(5% 0 85% 0);transform:translateX(-5px)}90%{clip-path:inset(55% 0 20% 0);transform:translateX(3px)}}
        @keyframes radarPing{0%{transform:scale(.1);opacity:.9}100%{transform:scale(4.5);opacity:0}}
        @keyframes stampDrop{0%{transform:rotate(-12deg) scale(2.5) translateY(-20px);opacity:0}60%{transform:rotate(-12deg) scale(.94);opacity:1}80%{transform:rotate(-12deg) scale(1.03)}100%{transform:rotate(-12deg) scale(1);opacity:1}}
        @keyframes ghostFloat{0%,100%{transform:translateY(0) translateX(-50%)}50%{transform:translateY(-8px) translateX(-50%)}}
        @keyframes ghostFadeIn{from{opacity:0;transform:translateY(14px) translateX(-50%)}to{opacity:1;transform:translateY(0) translateX(-50%)}}
        @keyframes terminalGlow{0%,100%{box-shadow:0 0 20px rgba(0,255,65,.15)}50%{box-shadow:0 0 50px rgba(0,255,65,.35)}}
        @keyframes scanPulse{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes starPop{0%{transform:scale(1) rotate(0deg)}25%{transform:scale(1.8) rotate(15deg)}55%{transform:scale(.85) rotate(-8deg)}80%{transform:scale(1.15) rotate(4deg)}100%{transform:scale(1) rotate(0deg)}}
        @keyframes starGlow{0%,100%{filter:drop-shadow(0 0 4px rgba(200,168,75,.4))}50%{filter:drop-shadow(0 0 14px rgba(200,168,75,1))}}
        @keyframes allFoundIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
        @keyframes goldShimmer{0%{background-position:-200% 50%}100%{background-position:200% 50%}}
        @keyframes starsReveal{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes mercyFlicker{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes newPulse{0%,100%{opacity:1}50%{opacity:.6}}
        @keyframes themeFlash{0%{opacity:1}25%{opacity:.1}50%{opacity:.9}75%{opacity:.05}100%{opacity:1}}
        @keyframes themeGlitch{0%,100%{transform:none}20%{transform:translate(3px,-2px)}40%{transform:translate(-3px,1px)}60%{transform:translate(2px,3px)}80%{transform:translate(-1px,-3px)}}
        @keyframes buttonGlow{0%{box-shadow:0 4px 12px rgba(0,0,0,0.08)}50%{box-shadow:0 8px 18px rgba(0,0,0,0.16)}100%{box-shadow:0 4px 12px rgba(0,0,0,0.08)}}
        .btn-animated{transition:transform .18s ease,box-shadow .18s ease,background .18s ease,color .18s ease;}
        .btn-animated:hover{transform:translateY(-1px) scale(1.01);box-shadow:0 10px 24px rgba(0,0,0,.16);}
        .btn-animated:active{transform:translateY(0) scale(.98);}
        .btn-animated.glow{animation:buttonGlow 3s ease infinite;}
        /* Corruption overlay visuals are now scoped to html.corrupt-lvl-* in global.css */
        /* Hero chromatic/glitch effect when corruption levels active */
        html.corrupt-lvl-4 .hero-title span,
        html.corrupt-lvl-5 .hero-title span,
        html.corrupt-lvl-6 .hero-title span,
        html.corrupt-lvl-7 .hero-title span,
        html.corrupt-lvl-8 .hero-title span,
        html.corrupt-lvl-9 .hero-title span,
        html.corrupt-lvl-10 .hero-title span {
          position: relative;
          text-shadow: 2px 0 0 rgba(224,61,12,.92), -2px 0 0 rgba(0,255,255,.6);
          animation: heroGlitch 1.8s steps(2) infinite;
        }
        @keyframes heroGlitch{0%{transform:none}25%{transform:translateX(2px)}50%{transform:translateX(-1px)}75%{transform:translateX(1px)}100%{transform:none}}
        @keyframes glitchLines{0%{background-position:0 0}100%{background-position:0 40px}}
        @keyframes glitchSweep{0%{transform:translateX(0)}50%{transform:translateX(100%)}100%{transform:translateX(0)}}
        input:focus,textarea:focus,select:focus{outline:2px solid #e03d0c!important;outline-offset:-1px}
        select option{background:${th.inputBg};color:${th.blk}}
      `}</style>

      {toast&&(
        <div style={{position:"fixed",top:20,right:20,zIndex:9999,padding:"10px 18px",border:th.bdr,background:toast.type==="err"?th.blk:th.card,color:toast.type==="err"?th.card:th.blk,fontFamily:"'IBM Plex Mono',monospace",fontSize:12,filter:"drop-shadow(3px 3px 0 rgba(0,0,0,.3))",animation:"toastIn .25s cubic-bezier(.22,1,.36,1) forwards"}}>
          {toast.msg}
        </div>
      )}

      {finalSurge&&(
        <div style={{position:"fixed",inset:0,zIndex:9400,background:"rgba(8,8,10,.94)",display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",padding:20}}>
          <div style={{position:"relative",width:"100%",maxWidth:520,padding:"44px 36px",border:"2px solid #e03d0c",background:"#060608",boxShadow:"0 0 0 8px rgba(224,61,12,.15)",overflow:"hidden",animation:"fadeIn .2s ease both"}}>
            <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 20% 20%,rgba(224,61,12,.08),transparent 22%),radial-gradient(circle at 80% 80%,rgba(255,255,255,.08),transparent 20%)"}}/>
            <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,#e03d0c,transparent)",animation:"glitchSweep 1.5s ease infinite"}}/>
            <div style={{position:"relative",fontFamily:"'Anton',sans-serif",fontSize:32,color:"#f8f4ee",letterSpacing:.4,marginBottom:16,textTransform:"uppercase",lineHeight:1.05,textShadow:"0 0 20px rgba(224,61,12,.33)"}}>SYSTEM OVERLOAD</div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#ccc",lineHeight:1.8,marginBottom:22}}>
              The vault could not contain the corruption anymore.<br/>
              A hidden payload tore through the interface and surfaced in featured as a glitchy asset.
            </p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
              {[0,1,2].map(i=>(
                <span key={i} style={{width:46,height:4,background:"#e03d0c",opacity:.7,animation:`glitchSweep ${1.2 + i*0.1}s ease-in-out infinite`,display:"inline-block"}}/>
              ))}
            </div>
          </div>
        </div>
      )}

      {ann.visible&&ann.text&&(
        <div style={{background:annC.bg,borderBottom:`2px solid ${annC.b}`,padding:"11px 40px",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:annC.t,textAlign:"center",lineHeight:1.6,animation:"annSlide .35s cubic-bezier(.22,1,.36,1) both",overflow:"hidden",whiteSpace:"nowrap",position:"relative"}}>
          {ann.text.length>60?(
            <div style={{display:"inline-flex",animation:`annMarquee ${Math.max(20, ann.text.length*0.12)}s linear infinite`}}>
              <span style={{paddingRight:100}}>{ann.text}</span>
              <span style={{paddingRight:100}}>{ann.text}</span>
            </div>
          ):(<span>{ann.text}</span>)}
        </div>
      )}

      <header style={{padding:"14px 40px",borderBottom:`1px solid ${th.div}`,background:th.heroBg,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:200,gap:10,flexWrap:"wrap", opacity: corruptionLevel >= 9 ? 0.9 : 1, filter: corruptionLevel >= 11 ? `brightness(${0.9 - corruptionLevel * 0.01})` : 'none'}}>
        <button onClick={handleLogoClick} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:12,flexShrink:0,transition:"transform 0.2s"}} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.05)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <circle cx="16" cy="16" r="14.5" stroke="#e03d0c" strokeWidth="2.5" opacity="0.9"/>
            <circle cx="16" cy="16" r="10" stroke={th.blk} strokeWidth="1" opacity="0.2"/>
            <circle cx="16" cy="16" r="3.5" fill="#e03d0c" filter="url(#glow)"/>
            <line x1="16" y1="5" x2="16" y2="10.5" stroke="#e03d0c" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
            <line x1="16" y1="21.5" x2="16" y2="27" stroke="#e03d0c" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
            <line x1="5" y1="16" x2="10.5" y2="16" stroke="#e03d0c" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
            <line x1="21.5" y1="16" x2="27" y2="16" stroke="#e03d0c" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
            <circle cx="16" cy="4.5" r="1.8" fill="#e03d0c" opacity="0.7"/>
            <circle cx="27.5" cy="16" r="1.8" fill="#e03d0c" opacity="0.5"/>
            <circle cx="4.5" cy="16" r="1.8" fill="#e03d0c" opacity="0.5"/>
          </svg>
          <span style={{display:"flex",flexDirection:"column",lineHeight:1,gap:2,textAlign:"left"}}>
            <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,letterSpacing:3,color:th.mut,textTransform:"uppercase",fontWeight:500}}>Software</span>
            <span style={{fontFamily:"'Anton',sans-serif",fontSize:22,letterSpacing:.8,color:th.blk,fontWeight:500}}>{logoDisplay==="SoftwareVault"?"Vault":logoDisplay}</span>
          </span>
        </button>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <select value={lang} onChange={e=>setLang(e.target.value)} style={{padding:"5px 8px",border:th.bdr,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,background:th.inputBg,color:th.blk,cursor:"pointer",filter:"drop-shadow(2px 2px 0 "+th.sh2.split(" ").slice(3).join(" ")+")"}}>
            {LANGS.map(l=><option key={l.c} value={l.c}>{l.l}</option>)}
          </select>
          <button onClick={handleThemeToggle} style={{width:34,height:34,border:th.bdr,background:th.card,color:th.blk,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",filter:`drop-shadow(4px 4px 0 ${th.sh2.split(" ").slice(3).join(" ")})`,transition:"filter 0.1s, transform 0.1s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";e.currentTarget.style.filter="drop-shadow(3px 3px 0 "+th.sh2.split(" ").slice(3).join(" ")+")";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.filter="drop-shadow(2px 2px 0 "+th.sh2.split(" ").slice(3).join(" ")+")";}}
            onMouseDown={e=>{e.currentTarget.style.transform="translate(1px,1px)";e.currentTarget.style.filter="drop-shadow(1px 1px 0 "+th.sh2.split(" ").slice(3).join(" ")+")";}}
            onMouseUp={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";}}>
            {isDark?"☀":"◑"}
          </button>
          <AuthButton lang={lang} th={th} partyUnlocked={partyUnlocked} partyMode={partyMode} onTogglePartyMode={setUserPartyEnabled} />
        </div>
      </header>

      {page==="home"&&(
        <main style={{opacity: corruptionLevel > 10 ? 0.92 : 1, filter: corruptionLevel >= 8 ? `invert(${corruptionLevel * 0.02})` : 'none'}}>
          <section style={{padding:"60px 40px 48px",borderBottom:`1px solid ${th.div}`,background:th.heroBg}}>
            <div style={{maxWidth:980,margin:"0 auto",position:"relative"}}>
              <h1 className="hero-title" onMouseDown={handleHeroTitleDown} onMouseUp={handleHeroTitleUp} onMouseLeave={handleHeroTitleUp} onTouchStart={handleHeroTitleDown} onTouchEnd={handleHeroTitleUp} style={{fontFamily:"'Anton',sans-serif",fontSize:"clamp(44px,7vw,84px)",fontWeight:400,lineHeight:1,letterSpacing:.3,marginBottom:18,cursor:"pointer",userSelect:"none", opacity: corruptionLevel >= 9 ? 0.7 + Math.random() * 0.2 : 1, textShadow: corruptionLevel >= 10 ? '3px 3px 0 #f43f5e, -2px -2px 0 #00ff00' : 'none'}}>
                <div style={{overflow:"hidden"}}><span style={{display:"block",animation:"heroReveal .55s cubic-bezier(.22,1,.36,1) both"}}>{tr.h1[0]}</span></div>
                <div style={{overflow:"hidden"}}><span style={{display:"block",color:"#e03d0c",animation:"heroReveal .55s cubic-bezier(.22,1,.36,1) .07s both"}}>{tr.h1[1]}</span></div>
              </h1>
              <p style={{fontSize:13,color:th.mut,lineHeight:1.85,maxWidth:480,marginBottom:28,fontFamily:"'IBM Plex Mono',monospace",animation:"fadeUp .5s ease .28s both"}}>{sett.heroSub||tr.sub}</p>
              <div onClick={handleStatsClick} style={{display:"flex",gap:24,flexWrap:"wrap",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:th.mut,borderTop:`1px solid ${th.div}`,paddingTop:20,cursor:"default",userSelect:"none"}}>
                <span style={{animation:"statSlide .45s ease .45s both"}}><strong style={{fontFamily:"'Anton',sans-serif",fontSize:20,color:th.blk,marginRight:5}}><CountUp to={progs.length}/></strong>{tr.progs}</span>
                <span style={{animation:"statSlide .45s ease .55s both"}}><strong style={{fontFamily:"'Anton',sans-serif",fontSize:20,color:th.blk,marginRight:5}}><CountUp to={totalDl}/></strong>{tr.dls}</span>
                {progs.some(p=>p.featured)&&<span style={{animation:"statSlide .45s ease .65s both"}}><strong style={{fontFamily:"'Anton',sans-serif",fontSize:20,color:"#e03d0c",marginRight:5}}><CountUp to={progs.filter(p=>p.featured).length}/></strong>{tr.feat}</span>}
              </div>
              {foundSecrets.length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:5,marginTop:20,paddingTop:16,borderTop:`1px solid ${th.div}`,animation:"starsReveal .5s cubic-bezier(.22,1,.36,1) both",flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:th.mut,marginRight:4,letterSpacing:2,opacity:.6}}>secrets</span>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>{
                    const found=foundSecrets.includes(n);
                    return <span key={n} style={{fontSize:15,lineHeight:1,display:"inline-block",color:found?"#c8a84b":th.div,filter:found?"drop-shadow(0 0 6px rgba(200,168,75,.7))":"none",transition:"color .5s, filter .5s",animation:starAnim===n?"starPop .75s cubic-bezier(.22,1,.36,1) both":found?"starGlow 2.5s ease infinite":"none", textShadow: corruptionLevel >= 11 && found ? `0 0 10px #f43f5e, 0 0 20px #ff00ff` : 'none'}}>★</span>;
                  })}
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:th.mut,marginLeft:4,opacity:.6}}>{foundSecrets.length}/12{foundSecrets.length===12?" ✓":""}</span>
                </div>
              )}
              {/* Vault integrity UI removed; keep a single Reveal Corruption control */}
              {foundSecrets.length > 0 && (
              <div style={{marginTop:18,display:"flex",gap:12,flexWrap:"wrap"}}>
                <Btn th={th} v={hideCorruption?"dark":"ghost"} onClick={()=>{ setHideCorruption(!hideCorruption); ping(hideCorruption?'Corruption revealed.':'Corruption hidden.'); }} style={{minWidth:180}}>
                  {hideCorruption?'Reveal corruption':'Hide corruption'}
                </Btn>
                <Btn th={th} v="ghost" onClick={resetCorruption} style={{minWidth:180}}>
                  Reset corruption
                </Btn>
              </div>
              )}
            </div>
          </section>

          <div style={{maxWidth:980,margin:"0 auto",padding:"28px 40px 0"}}>
            <div style={{display:"grid",gap:10,marginBottom:14}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {CATS.map((c,i)=>{
                  const count=c==="All"?progs.length:progs.filter(p=>p.cat===c).length;
                  return <button key={c} className="btn-animated" onClick={()=>setCat(c)} style={{...baseBtn(cat===c),marginBottom:8,position:"relative",zIndex:cat===c?2:1}}>
                    {tr.cats[i]||c} <span style={{opacity:.4}}>{`(${count})`}</span>
                  </button>;
                })}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>
                {user&&<button onClick={()=>setMyAppsOnly(v=>!v)} className="btn-animated" style={{...baseBtn(myAppsOnly),minWidth:120}}>{lt.myapps}</button>}
                <select className="btn-animated" value={sort} onChange={e=>setSort(e.target.value)} style={{padding:"7px 10px",border:th.bdr,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,background:th.inputBg,color:th.blk,cursor:"pointer",filter:`drop-shadow(3px 3px 0 ${th.sh2.split(" ").slice(3).join(" ")})`,minWidth:170,transition:"filter 0.1s ease, transform 0.1s ease"}}>
                  <option value="newest">{tr.sn}</option>
                  <option value="popular">{tr.sp}</option>
                  <option value="az">{tr.sa}</option>
                </select>
              </div>
            </div>
            <input className="secret-search" style={{...inp,padding:"11px 14px",marginBottom:12}} placeholder={tr.search} value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={handleSearchKeyDown}/>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:28,paddingTop:12,borderTop:`1px solid ${th.div}`}}>
              <span style={{fontSize:11,color:th.mut,marginRight:4,fontFamily:"'IBM Plex Mono',monospace"}}>{tr.platform}</span>
              {OSS.map(o=><button key={o.id} className="btn-animated" onClick={()=>setOsFilter(f=>f.includes(o.id)?f.filter(x=>x!==o.id):[...f,o.id])} style={{...baseBtn(osFilter.includes(o.id)),marginRight:8,marginBottom:8}}>{o.l}</button>)}
              {osFilter.length>0&&<button onClick={()=>setOsFilter([])} style={{background:"none",border:"none",fontSize:11,color:"#e03d0c",cursor:"pointer",textDecoration:"underline",fontFamily:"'IBM Plex Mono',monospace",padding:0}}>{tr.clear}</button>}
            </div>
          </div>

          <div style={{maxWidth:980,margin:"0 auto",padding:"0 40px 60px"}}>
            {vis.length===0?(
              <div style={{padding:"60px 40px",border:th.bdr,background:th.card,textAlign:"center",fontFamily:"'IBM Plex Mono',monospace",color:th.mut,fontSize:13,boxShadow:th.shd}}>
                <span style={{animation:"emptyPulse 2.4s ease infinite"}}>{progs.length===0?tr.e1:tr.e2}</span>
              </div>
            ):(
              <>
                {featVis.length>0&&(
                  <div style={{marginBottom:36}}>
                    <Divider label={tr.fdiv} th={th}/>
                    <div key={gridKey+"f"} style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:20}}>
                      {featVis.map((p,i)=>(
                        <div key={p.id} style={{animation:`fadeUp .38s cubic-bezier(.22,1,.36,1) ${i*.06}s both`}}>
                          <CardWithSecrets p={p} onDownload={download} onLike={handleLike} liked={likes.includes(p.id)} inLibrary={library.includes(p.id)} onToggleLibrary={handleToggleLibrary} lt={lt} onDetail={setDetailProg} loadingDl={loadingDl} th={th} tr={tr}/>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {regVis.length>0&&(<>
                  {featVis.length>0&&<Divider label={tr.adiv} th={th}/>}
                  <div key={gridKey+"r"} style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:20}}>
                    {regVis.map((p,i)=>(
                      <div key={p.id} style={{animation:`fadeUp .38s cubic-bezier(.22,1,.36,1) ${i*.06}s both`}}>
                        <CardWithSecrets p={p} onDownload={download} onLike={handleLike} liked={likes.includes(p.id)} inLibrary={library.includes(p.id)} onToggleLibrary={handleToggleLibrary} lt={lt} onDetail={setDetailProg} loadingDl={loadingDl} th={th} tr={tr}/>
                      </div>
                    ))}
                  </div>
                </>)}
              </>
            )}
          </div>

          {sup.visible&&sup.url&&(
            <div style={{maxWidth:460,margin:"0 auto 60px",padding:"0 40px"}}>
              <div style={{background:th.card,border:th.bdr,padding:"28px 28px 24px",boxShadow:th.shd,textAlign:"center"}}>
                <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:th.mut,lineHeight:1.85,marginBottom:20}}>{sup.msg||tr.ppm}</p>
                <a href={sup.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",display:"block"}}>
                  <Btn v="primary" full th={th} style={{padding:"12px",fontSize:13,letterSpacing:.5}}>{tr.pp}</Btn>
                </a>
              </div>
            </div>
          )}
        </main>
      )}

      {page==="admin"&&isAdmin&&(
        <main style={{maxWidth:800,margin:"0 auto",padding:"48px 40px 80px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:32}}>
            <h1 style={{fontFamily:"'Anton',sans-serif",fontSize:32,fontWeight:400,letterSpacing:.3,color:th.blk}}>{tr.adh}</h1>
            <Btn sm th={th} onClick={()=>{setModal("changepw");setPwErr("");setPw("");setPw2("");}}>{tr.cpb}</Btn>
          </div>

          <div style={{display:"flex",gap:0,marginBottom:36,borderBottom:th.bdr}}>
            {[{id:"programs",label:"Programs"},{id:"site",label:"Site"},{id:"secrets",label:"Secrets ◉"}].map(t=>(
              <button key={t.id} onClick={()=>setAdminTab(t.id)} style={{padding:"12px 22px",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,border:"none",borderBottom:`3px solid ${adminTab===t.id?"#e03d0c":"transparent"}`,background:"none",color:adminTab===t.id?th.blk:th.mut,cursor:"pointer",marginBottom:-2,transition:"color .2s ease, border-color .2s ease",letterSpacing:.5}}>
                {t.label}
              </button>
            ))}
          </div>

          {adminTab==="programs"&&(
            <div style={{animation:"slidedown 0.3s cubic-bezier(0.22, 1, 0.36, 1)"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:14,marginBottom:40}}>
                {[{l:tr.stp,v:progs.length},{l:tr.std,v:fmt.n(totalDl)},{l:tr.stpin,v:progs.filter(p=>p.featured).length},{l:tr.sttop,v:topProg?.name||"—",sm:true}].map(({l,v,sm})=>(
                  <div key={l} style={{background:th.card,border:th.bdr,padding:"18px 20px",boxShadow:th.sh2,transition:"all .2s ease",cursor:"default","&:hover":{transform:"translateY(-2px)",boxShadow:`${th.sh2.replace("0", "2")}`}}}>
                    <div style={{fontSize:10,color:th.mut,marginBottom:8,fontFamily:"'IBM Plex Mono',monospace"}}>{l}</div>
                    <div style={{fontFamily:sm?"'IBM Plex Mono',monospace":"'Anton',sans-serif",fontSize:sm?13:26,letterSpacing:sm?0:.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:th.blk}}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{background:th.card,border:th.bdr,padding:32,boxShadow:th.shd,marginBottom:32}}>
                <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:20,fontWeight:400,marginBottom:24,letterSpacing:.3,color:th.blk}}>{tr.add}</h2>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:18}}>
                  <div><label style={lbl}>{tr.nl}</label><input style={inp} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="My tool"/></div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div><label style={lbl}>{tr.vl}</label><input style={inp} value={form.ver} onChange={e=>setForm({...form,ver:e.target.value})} placeholder="1.0"/></div>
                    <div><label style={lbl}>{tr.cl}</label>
                      <select style={{...inp,cursor:"pointer"}} value={form.cat} onChange={e=>setForm({...form,cat:e.target.value})}>
                        {CATS.filter(c=>c!=="All").map((c,i)=><option key={c} value={c}>{tr.cats[i+1]||c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div style={{marginBottom:18}}><label style={lbl}>{tr.dl2}</label><textarea style={{...inp,height:80,resize:"vertical"}} value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})} placeholder="What does it do?"/></div>
                
                <div key={uploadKey} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:18}}>
                  <ImageUploadField label={tr.cov} tip={tr.img_tip} single images={form.coverImage?[form.coverImage]:[]}
                    onChange={async e=>{const f=e.target.files[0];if(!f)return;const img=await processCoverImage(f);if(img)setForm(x=>({...x,coverImage:img}));else ping("Couldn't process image.","err");}}
                    onRemove={()=>setForm(x=>({...x,coverImage:null}))} th={th} lbl={lbl} maxCount={1}/>
                  <ImageUploadField label={tr.scr} tip={tr.img_tip} single={false} images={form.screenshots||[]}
                    onChange={async e=>{const files=Array.from(e.target.files).slice(0,6-(form.screenshots||[]).length);const imgs=await Promise.all(files.map(f=>processScreenshot(f)));setForm(x=>({...x,screenshots:[...(x.screenshots||[]),...imgs.filter(Boolean)].slice(0,6)}));}}
                    onRemove={i=>setForm(x=>({...x,screenshots:x.screenshots.filter((_,j)=>j!==i)}))} th={th} lbl={lbl} maxCount={6}/>
                </div>
                <div key={uploadKey} style={{marginBottom:22}}>
                  <label style={lbl}>Downloads (one file per platform)</label>
                  {OS_DL.map(o=>(
                    <div key={o.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                      <span style={{width:74,fontSize:11,fontFamily:"'IBM Plex Mono',monospace",color:th.blk}}>{o.l}</span>
                      <input type="file" style={{...inp,padding:"7px 10px",flex:1,marginBottom:0}} onChange={e=>setForm(f=>({...f,builds:{...f.builds,[o.id]:{...f.builds[o.id],file:e.target.files[0]||null}}}))}/>
                      <input style={{...inp,flex:1,marginBottom:0}} placeholder="or paste a URL" value={form.builds?.[o.id]?.url||""} onChange={e=>setForm(f=>({...f,builds:{...f.builds,[o.id]:{...f.builds[o.id],url:e.target.value}}}))}/>
                    </div>
                  ))}
                  <p style={{fontSize:10,color:th.mut,marginTop:6,fontFamily:"'IBM Plex Mono',monospace"}}>{tr.bf}</p>
                  <div style={{marginTop:14}}><label style={lbl}>Web app URL (optional)</label><input style={inp} value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://… (opens in browser)"/></div>
                </div>
                 <Btn v="primary" onClick={upload} disabled={busy} th={th} style={{padding:"11px 32px"}}>{busy?tr.adng:tr.ab}</Btn>
              </div>

              {progs.length>0&&(
                <div>
                  <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:20,fontWeight:400,marginBottom:16,letterSpacing:.3,color:th.blk}}>{tr.mgmt} ({progs.length})</h2>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {[...progs].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(p=>(
                      <div key={p.id} style={{background:th.card,border:th.bdr,padding:"15px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,boxShadow:th.sh2,transition:"all .2s ease"}}>
                        <div style={{flex:1,minWidth:0,display:"flex",gap:14,alignItems:"center"}}>
                          {p.coverImage&&<div style={{width:46,height:46,flexShrink:0,border:th.bdr,overflow:"hidden"}}><img src={p.coverImage} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5,flexWrap:"wrap"}}>
                              {p.featured&&<span style={{color:"#e03d0c",fontSize:12}}>★</span>}
                              {fmt.isNew(p.date)&&<span style={{fontSize:9,padding:"2px 6px",background:"#e03d0c",color:"#fff",fontFamily:"'IBM Plex Mono',monospace",letterSpacing:1}}>NEW</span>}
                              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,fontWeight:500,color:th.blk}}>{p.name}</span>
                              <span style={{fontSize:10,padding:"1px 7px",border:th.bdr,color:th.blk}}>{p.cat}</span>
                            </div>
                            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:th.mut}}>↓{p.dl||0} · ♥{p.likes||0} · v{p.ver} · {fmt.d(p.date)}</div>
                          </div>
                        </div>
                        {delId===p.id?(
                          <div style={{display:"flex",gap:6,flexShrink:0,animation:"slidedown 0.2s cubic-bezier(0.22, 1, 0.36, 1)"}}>
                            <Btn sm v="danger" th={th} onClick={()=>remove(p.id)}>{tr.yd}</Btn>
                            <Btn sm th={th} onClick={()=>setDelId(null)}>{tr.cncl}</Btn>
                          </div>
                        ):(
                          <div style={{display:"flex",gap:6,flexShrink:0}}>
                            <button title={p.featured?tr.upin:tr.pin} onClick={()=>toggleFeatured(p.id)} style={{padding:"5px 10px",border:th.bdr,background:p.featured?"#e03d0c":th.card,color:p.featured?th.card:th.blk,cursor:"pointer",fontSize:13,filter:"drop-shadow(2px 2px 0 "+th.sh2.split(" ").slice(3).join(" ")+")",transition:"filter .1s, transform .1s, background .2s ease, color .2s ease"}}
                              onMouseEnter={e=>{e.currentTarget.style.transform="translate(-1px,-1px) scale(1.05)";}}
                              onMouseLeave={e=>{e.currentTarget.style.transform="none";}}
                              onMouseDown={e=>{e.currentTarget.style.transform="translate(1px,1px) scale(.98)";}}
                              onMouseUp={e=>{e.currentTarget.style.transform="translate(-1px,-1px) scale(1.05)";}}>★</button>
                            <Btn sm th={th} onClick={()=>{setEditId(p.id);setEditForm({name:p.name,desc:p.desc||"",ver:p.ver||"1.0",cat:p.cat||"Tools",url:p.url||"",os:p.os||[],downloads:p.downloads||{},builds:freshEditBuilds(),coverImage:p.coverImage||null,screenshots:p.screenshots||[]});setModal("edit");}}>{tr.ed}</Btn>
                            <Btn sm v="danger" th={th} onClick={()=>setDelId(p.id)}>{tr.del}</Btn>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {adminTab==="site"&&(
            <div style={{display:"flex",flexDirection:"column",gap:24,animation:"slidedown 0.3s cubic-bezier(0.22, 1, 0.36, 1)"}}>
              <div style={{background:th.card,border:th.bdr,padding:24,boxShadow:th.sh2,transition:"all .2s ease"}}>
                <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:18,fontWeight:400,marginBottom:12,letterSpacing:.3,color:th.blk}}>Admin email</h2>
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:th.mut,marginBottom:6,fontFamily:"'IBM Plex Mono',monospace"}}>Current</div>
                  <div style={{padding:10,border:th.bdr,background:th.inputBg,color:th.blk}}>{adminEmail||"(not set)"}</div>
                </div>
                <div style={{marginBottom:12}}>
                  <label style={lbl}>Set email</label>
                  <input style={inp} value={adminEmailDraft} onChange={e=>setAdminEmailDraft(e.target.value)} placeholder="admin@example.com" />
                </div>
                <div style={{display:"flex",gap:8}}>
                  <Btn sm v="primary" th={th} onClick={saveAdminEmail}>Save admin email</Btn>
                  <Btn sm v="secondary" th={th} onClick={sendTestEmail} disabled={busy}>Send test email</Btn>
                </div>
              </div>
              <div style={{background:th.card,border:th.bdr,padding:24,boxShadow:th.sh2,transition:"all .2s ease"}}>
                <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:18,fontWeight:400,marginBottom:12,letterSpacing:.3,color:th.blk}}>Two-Factor Authentication</h2>
                <p style={{fontSize:12,color:th.mut,marginBottom:14,fontFamily:"'IBM Plex Mono',monospace",lineHeight:1.6}}>Require a 2FA code when logging in. If disabled, only password is required.</p>
                <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.blk,userSelect:"none"}}>
                    <input type="checkbox" checked={twoFactorEnabledDraft} onChange={e=>setTwoFactorEnabledDraft(e.target.checked)} style={{width:14,height:14,cursor:"pointer",accentColor:"#e03d0c"}}/>
                    Enable 2FA
                  </label>
                  <Btn sm v="primary" th={th} onClick={saveTwoFactorSetting}>Save</Btn>
                </div>
              </div>
              <div style={{background:th.card,border:th.bdr,padding:32,boxShadow:th.sh2,transition:"all .2s ease"}}>
                <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:20,fontWeight:400,marginBottom:20,letterSpacing:.3,color:th.blk}}>{tr.anh}</h2>
                {ann.visible&&ann.text&&<div style={{padding:"10px 14px",marginBottom:16,background:annC.bg,border:`1px solid ${annC.b}`,fontSize:12,color:annC.t,fontFamily:"'IBM Plex Mono',monospace",lineHeight:1.6}}>✓ {tr.anl}: {`"${ann.text.slice(0,60)}${ann.text.length>60?"...":""}"`}</div>}
                <textarea style={{...inp,height:72,resize:"vertical",marginBottom:16}} value={annDraft.text} onChange={e=>setAnnDraft(a=>({...a,text:e.target.value}))} placeholder={tr.anph}/>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{fontSize:11,color:th.mut,fontFamily:"'IBM Plex Mono',monospace"}}>{tr.ant}:</span>
                  {["info","warning","update"].map(t=>(
                    <button key={t} onClick={()=>setAnnDraft(a=>({...a,type:t}))} style={{padding:"5px 12px",cursor:"pointer",border:th.bdr,fontSize:11,fontFamily:"'IBM Plex Mono',monospace",background:annDraft.type===t?th.blk:th.card,color:annDraft.type===t?th.card:th.blk,transition:"all .2s ease"}}>
                      {t==="info"?tr.ani:t==="warning"?tr.anw:tr.anu}
                    </button>
                  ))}
                  <Btn sm v="primary" th={th} onClick={saveAnn}>{tr.ans}</Btn>
                  {ann.visible&&<Btn sm v="danger" th={th} onClick={clearAnn}>{tr.anc}</Btn>}
                </div>
              </div>
              <div style={{background:th.card,border:th.bdr,padding:32,boxShadow:th.sh2,transition:"all .2s ease"}}>
                <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:20,fontWeight:400,marginBottom:20,letterSpacing:.3,color:th.blk}}>{tr.ppadm}</h2>
                <div style={{marginBottom:16}}><label style={lbl}>{tr.ppurl}</label><input style={inp} value={ppDraft.url} onChange={e=>setPpDraft(p=>({...p,url:e.target.value}))} placeholder="https://paypal.me/yourname"/></div>
                <div style={{marginBottom:18}}><label style={lbl}>{tr.ppmsglbl}</label><textarea style={{...inp,height:68,resize:"vertical"}} value={ppDraft.msg} onChange={e=>setPpDraft(p=>({...p,msg:e.target.value}))} placeholder={tr.ppm}/></div>
                <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.blk,userSelect:"none"}}>
                    <input type="checkbox" checked={ppDraft.visible} onChange={e=>setPpDraft(p=>({...p,visible:e.target.checked}))} style={{width:14,height:14,cursor:"pointer",accentColor:"#e03d0c"}}/>
                    {tr.ppvis}
                  </label>
                  <Btn sm v="primary" th={th} onClick={saveSupport}>{tr.ans}</Btn>
                </div>
              </div>
            </div>
          )}

          {adminTab==="secrets"&&(
            <div style={{animation:"slidedown 0.3s cubic-bezier(0.22, 1, 0.36, 1)"}}>
              <div style={{background:th.card,border:th.bdr,padding:28,boxShadow:th.sh2,marginBottom:28}}>
                <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:20,fontWeight:400,letterSpacing:.3,color:th.blk,marginBottom:10}}>Secret Downloads</h2>
                <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:th.mut,lineHeight:1.85,marginBottom:20}}>Each secret can optionally reveal a hidden download when triggered.</p>
                <div style={{display:"flex",alignItems:"center",gap:5,paddingTop:16,borderTop:`1px solid ${th.div}`,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:th.mut,marginRight:4}}>found on this device:</span>
                  {[1,2,3,4,5,6,7,8,9,10].map(n=>{
                    const found=foundSecrets.includes(n);
                    return <span key={n} style={{fontSize:15,color:found?"#c8a84b":th.div,filter:found?"drop-shadow(0 0 5px rgba(200,168,75,.7))":"none",transition:"all .3s"}}>★</span>;
                  })}
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:th.mut}}>{foundSecrets.length}/12</span>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {SECRET_LABELS.map((sl,idx)=>{
                  const dl=sdDraft[idx]||{...BLANK_DL};
                  const isLive=sett.secretDownloads?.[idx]?.enabled&&sett.secretDownloads?.[idx]?.name;
                  const found=foundSecrets.includes(idx+1);
                  return(
                    <div key={idx} style={{background:th.card,border:th.bdr,padding:24,boxShadow:th.sh2,transition:"all .2s ease"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                        <div style={{flex:1,minWidth:0,marginRight:12}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                            <span style={{fontSize:16,color:found?"#c8a84b":th.div,filter:found?"drop-shadow(0 0 5px rgba(200,168,75,.6))":"none",transition:"all .3s",flexShrink:0}}>★</span>
                            <span style={{fontFamily:"'Anton',sans-serif",fontSize:16,fontWeight:400,letterSpacing:.3,color:th.blk}}>#{idx+1} — {sl.trigger}</span>
                          </div>
                          <div style={{background:th.bg,border:`1px solid ${th.div}`,padding:"10px 14px"}}>
                            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:th.mut,letterSpacing:2,marginBottom:5}}>HOW TO TRIGGER</div>
                            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.blk,lineHeight:1.75}}>{sl.howto}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
                          {found&&<span style={{fontSize:10,color:"#c8a84b",fontFamily:"'IBM Plex Mono',monospace",letterSpacing:1}}>★ FOUND</span>}
                          {isLive&&<span style={{fontSize:10,color:"#22c55e",fontFamily:"'IBM Plex Mono',monospace"}}>● live</span>}
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                        <div><label style={lbl}>Program name</label><input style={inp} value={dl.name} onChange={e=>updateSd(idx,"name",e.target.value)} placeholder="Hidden reward..."/></div>
                        <div><label style={lbl}>Download URL</label><input style={inp} value={dl.url} onChange={e=>updateSd(idx,"url",e.target.value)} placeholder="https://..."/></div>
                      </div>
                      <div style={{marginBottom:14}}><label style={lbl}>Short description (optional)</label><textarea style={{...inp,height:48,resize:"vertical"}} value={dl.desc} onChange={e=>updateSd(idx,"desc",e.target.value)} placeholder="A reward for the curious..."/></div>
                      <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.blk,userSelect:"none"}}>
                          <input type="checkbox" checked={!!dl.enabled} onChange={e=>updateSd(idx,"enabled",e.target.checked)} style={{width:14,height:14,cursor:"pointer",accentColor:"#e03d0c"}}/>
                          Enable download for this secret
                        </label>
                        <Btn sm v="primary" th={th} onClick={()=>saveSecretDownload(idx)}>Save</Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      )}

      <footer style={{borderTop:`1px solid ${th.div}`,padding:"16px 40px",display:"flex",justifyContent:"space-between",alignItems:"center",background:th.heroBg}}>
        <span onMouseMove={handleFooterVaultMove} onMouseLeave={handleFooterVaultLeave} style={{fontFamily:"'Anton',sans-serif",fontSize:14,letterSpacing:.3,color:th.blk,cursor:"default",userSelect:"none"}}>SoftwareVault</span>
        <span onClick={handleFooterYearClick} style={{fontSize:11,color:th.mut,fontFamily:"'IBM Plex Mono',monospace",cursor:"default",userSelect:"none"}}>{new Date().getFullYear()}</span>
      </footer>

      {detailProg&&<DetailModal prog={detailProg} liked={likes.includes(detailProg.id)} onLike={handleLike} inLibrary={library.includes(detailProg.id)} onToggleLibrary={handleToggleLibrary} lt={lt} onDownload={download} loadingDl={loadingDl} onClose={()=>setDetailProg(null)} th={th} tr={tr}/>}

      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:20,animation:"fadein .2s ease",backdropFilter:"blur(0px)"}} {...modalBackdrop}>
          {(modal==="login"||modal==="setup"||modal==="changepw")&&(
            <div onClick={e=>e.stopPropagation()} style={{background:th.card,border:th.bdr,padding:32,width:"100%",maxWidth:360,boxShadow:`8px 8px 0 ${th.blk}`,animation:"modalIn .3s cubic-bezier(.22,1,.36,1) both"}}>
              <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:22,fontWeight:400,marginBottom:modal==="setup"?10:20,letterSpacing:.3,color:th.blk}}>{modal==="login"?tr.si:modal==="setup"?tr.sat:tr.cp}</h2>
              {modal==="setup"&&<p style={{fontSize:12,color:th.mut,lineHeight:1.8,marginBottom:18,fontFamily:"'IBM Plex Mono',monospace"}}>{tr.ot}</p>}
              {modal==="setup"&&(
                <>
                  <label style={lbl}>Email address</label>
                  <input type="email" style={{...inp,marginBottom:12}} value={setupEmail} onChange={e=>setSetupEmail(e.target.value)} placeholder="you@example.com" />
                </>
              )}
              {modal==="changepw"&&(<>
                <label style={lbl}>{lang==="de"?"aktuelles Passwort":"current password"}</label>
                <input type="password" style={{...inp,marginBottom:12}} value={curPw} onChange={e=>setCurPw(e.target.value)} placeholder="••••••••"/>
              </>)}
              <label style={lbl}>{modal==="login"?tr.pw:modal==="changepw"?tr.pwn:tr.pwm}</label>
              <input type="password" style={{...inp,marginBottom:12}} value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){modal==="login"?login():modal==="changepw"?changePw():setupAdmin();}}} placeholder="••••••••" autoFocus/>
              {modal==="login"&&loginRequires2fa&&(
                <>
                  <label style={lbl}>2FA code</label>
                  <input type="text" style={{...inp,marginBottom:12}} value={loginOtp} onChange={e=>setLoginOtp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")login();}} placeholder="000000" />
                  <div style={{fontSize:11,color:th.mut,marginBottom:12,lineHeight:1.6,fontFamily:"'IBM Plex Mono',monospace"}}>{loginMessage || `A 2FA code was requested for ${adminEmail||'your admin email'}.`}</div>
                </>
              )}
              {(modal==="setup"||modal==="changepw")&&(<>
                <label style={lbl}>{tr.conf}</label>
                <input type="password" style={{...inp,marginBottom:12}} value={pw2} onChange={e=>setPw2(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){modal==="changepw"?changePw():setupAdmin();}}} placeholder="••••••••"/>
              </>)}
              {pwErr&&<p style={{fontSize:12,color:"#e03d0c",marginBottom:12,fontFamily:"'IBM Plex Mono',monospace"}}>{pwErr}</p>}
              {modal==="setup"&&<p style={{fontSize:10,color:th.mut,marginBottom:16,lineHeight:1.75,padding:"8px 12px",background:th.bg,border:`1px solid ${th.div}`,fontFamily:"'IBM Plex Mono',monospace"}}>{tr.lw}</p>}
              {modal==="login"&&!loginRequires2fa&&(<button onClick={()=>{setModal("reset");setResetStep("request");setResetErr("");setResetMsg("");setResetCode("");setPw("");setPw2("");}} style={{background:"none",border:"none",color:th.mut,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,cursor:"pointer",padding:0,marginBottom:14,textDecoration:"underline",display:"block"}}>{lang==="de"?"Passwort vergessen?":"Forgot password?"}</button>)}
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <Btn sm th={th} onClick={closeModal}>{tr.cncl}</Btn>
                <Btn sm v="primary" th={th} onClick={modal==="login"?login:modal==="changepw"?changePw:setupAdmin}>{modal==="login"?tr.si:modal==="changepw"?tr.sv:tr.ca}</Btn>
              </div>
            </div>
          )}
          {modal==="reset"&&(
            <div onClick={e=>e.stopPropagation()} style={{background:th.card,border:th.bdr,padding:32,width:"100%",maxWidth:360,boxShadow:`8px 8px 0 ${th.blk}`,animation:"modalIn .3s cubic-bezier(.22,1,.36,1) both"}}>
              <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:22,fontWeight:400,marginBottom:14,letterSpacing:.3,color:th.blk}}>{lang==="de"?"Passwort zurücksetzen":"Reset password"}</h2>
              {resetStep==="request"?(<>
                <p style={{fontSize:12,color:th.mut,lineHeight:1.7,marginBottom:18,fontFamily:"'IBM Plex Mono',monospace"}}>{lang==="de"?"Wir senden einen Reset-Code an deine Admin-E-Mail.":"We'll email a reset code to your admin email."}</p>
                {resetErr&&<p style={{fontSize:12,color:"#e03d0c",marginBottom:12,fontFamily:"'IBM Plex Mono',monospace"}}>{resetErr}</p>}
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <Btn sm th={th} onClick={()=>{setModal("login");setResetErr("");}}>{tr.cncl}</Btn>
                  <Btn sm v="primary" th={th} onClick={requestReset}>{lang==="de"?"Code senden":"Send code"}</Btn>
                </div>
              </>):(<>
                {resetMsg&&<p style={{fontSize:11,color:th.mut,marginBottom:12,lineHeight:1.6,fontFamily:"'IBM Plex Mono',monospace"}}>{resetMsg}</p>}
                <label style={lbl}>{lang==="de"?"Reset-Code":"reset code"}</label>
                <input type="text" style={{...inp,marginBottom:12}} value={resetCode} onChange={e=>setResetCode(e.target.value)} placeholder="000000" autoFocus/>
                <label style={lbl}>{tr.pwn}</label>
                <input type="password" style={{...inp,marginBottom:12}} value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••"/>
                <label style={lbl}>{tr.conf}</label>
                <input type="password" style={{...inp,marginBottom:12}} value={pw2} onChange={e=>setPw2(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")confirmReset();}} placeholder="••••••••"/>
                {resetErr&&<p style={{fontSize:12,color:"#e03d0c",marginBottom:12,fontFamily:"'IBM Plex Mono',monospace"}}>{resetErr}</p>}
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <Btn sm th={th} onClick={()=>{setModal("login");setResetErr("");setResetStep("request");}}>{tr.cncl}</Btn>
                  <Btn sm v="primary" th={th} onClick={confirmReset}>{lang==="de"?"Zurücksetzen":"Reset"}</Btn>
                </div>
              </>)}
            </div>
          )}
          {modal==="edit"&&editId&&(
            <div onClick={e=>e.stopPropagation()} style={{background:th.card,border:th.bdr,padding:32,width:"100%",maxWidth:560,boxShadow:`8px 8px 0 ${th.blk}`,animation:"modalIn .3s cubic-bezier(.22,1,.36,1) both",maxHeight:"90vh",overflowY:"auto"}}>
              <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:22,fontWeight:400,marginBottom:20,letterSpacing:.3,color:th.blk}}>{tr.edh}</h2>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                <div><label style={lbl}>{tr.nl.replace(" *","")}</label><input style={inp} value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})}/></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><label style={lbl}>{tr.vl}</label><input style={inp} value={editForm.ver} onChange={e=>setEditForm({...editForm,ver:e.target.value})}/></div>
                  <div><label style={lbl}>{tr.cl}</label><select style={{...inp,cursor:"pointer"}} value={editForm.cat} onChange={e=>setEditForm({...editForm,cat:e.target.value})}>{CATS.filter(c=>c!=="All").map((c,i)=><option key={c} value={c}>{tr.cats[i+1]||c}</option>)}</select></div>
                </div>
              </div>
              <div style={{marginBottom:14}}><label style={lbl}>{tr.dl2}</label><textarea style={{...inp,height:72,resize:"vertical"}} value={editForm.desc} onChange={e=>setEditForm({...editForm,desc:e.target.value})}/></div>
              <div style={{marginBottom:14}}><label style={lbl}>Web app URL (optional)</label><input style={inp} value={editForm.url} onChange={e=>setEditForm({...editForm,url:e.target.value})} placeholder="https://… (opens in browser)"/></div>
                            <div style={{marginBottom:14}}>
                <label style={lbl}>Downloads (one file per platform)</label>
                {OS_DL.map(o=>{
                  const cur=(editForm.downloads||{})[o.id];
                  const b=(editForm.builds||{})[o.id]||{};
                  return (
                    <div key={o.id} style={{marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${th.div}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                        <span style={{width:74,fontSize:11,fontFamily:"'IBM Plex Mono',monospace",color:th.blk}}>{o.l}</span>
                        <span style={{fontSize:11,color:cur?th.blk:th.mut,fontFamily:"'IBM Plex Mono',monospace",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cur?("current: "+(cur.name||cur.url)):"(no build)"}</span>
                        {cur&&(<label style={{fontSize:11,color:"#e03d0c",fontFamily:"'IBM Plex Mono',monospace",display:"flex",alignItems:"center",gap:4,cursor:"pointer",whiteSpace:"nowrap"}}><input type="checkbox" checked={!!b.remove} onChange={e=>setEditForm(f=>({...f,builds:{...f.builds,[o.id]:{...f.builds[o.id],remove:e.target.checked}}}))} style={{accentColor:"#e03d0c",cursor:"pointer"}}/>remove</label>)}
                      </div>
                      <div style={{display:"flex",gap:8,opacity:b.remove?0.4:1}}>
                        <input type="file" disabled={!!b.remove} style={{...inp,padding:"7px 10px",flex:1,marginBottom:0}} onChange={e=>setEditForm(f=>({...f,builds:{...f.builds,[o.id]:{...f.builds[o.id],file:e.target.files[0]||null}}}))}/>
                        <input disabled={!!b.remove} style={{...inp,flex:1,marginBottom:0}} placeholder={cur?"replace with a URL":"or paste a URL"} value={b.url||""} onChange={e=>setEditForm(f=>({...f,builds:{...f.builds,[o.id]:{...f.builds[o.id],url:e.target.value}}}))}/>
                      </div>
                    </div>
                  );
                })}
                <p style={{fontSize:10,color:th.mut,marginTop:4,fontFamily:"'IBM Plex Mono',monospace"}}>{tr.bf}</p>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
                <ImageUploadField label={tr.cov} single images={editForm.coverImage?[editForm.coverImage]:[]}
                  onChange={async e=>{const f=e.target.files[0];if(!f)return;const img=await processCoverImage(f);if(img)setEditForm(x=>({...x,coverImage:img}));}}
                  onRemove={()=>setEditForm(x=>({...x,coverImage:null}))} th={th} lbl={lbl} maxCount={1}/>
                <ImageUploadField label={tr.scr} single={false} images={editForm.screenshots||[]}
                  onChange={async e=>{const files=Array.from(e.target.files).slice(0,6-(editForm.screenshots||[]).length);const imgs=await Promise.all(files.map(f=>processScreenshot(f)));setEditForm(x=>({...x,screenshots:[...(x.screenshots||[]),...imgs.filter(Boolean)].slice(0,6)}));}}
                  onRemove={i=>setEditForm(x=>({...x,screenshots:x.screenshots.filter((_,j)=>j!==i)}))} th={th} lbl={lbl} maxCount={6}/>
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <Btn sm th={th} onClick={()=>setModal(null)}>{tr.cncl}</Btn>
                <Btn sm v="primary" th={th} onClick={saveEdit} disabled={busy}>{busy?(lang==="de"?"Speichern…":"Saving…"):tr.sc}</Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SECRET LOCKS (one per active secret, z-index 9001, above overlays) ── */}
      {[
        {active:secret1,  close:()=>setSecret1(false)},
        {active:secret2,  close:()=>setSecret2(false)},
        {active:secret3,  close:()=>setSecret3(false)},
        {active:secret4,  close:()=>setSecret4(false)},
        {active:secret5,  close:()=>setSecret5(false)},
        {active:secret6,  close:()=>setSecret6(false)},
        {active:secret7,  close:()=>setSecret7(false)},
        {active:secret8,  close:()=>setSecret8(false)},
        {active:secret9,  close:()=>setSecret9(false)},
        {active:secret10, close:()=>setSecret10(false)},
        {active:secret11, close:()=>setSecret11(false)},
        {active:secret12, close:()=>setSecret12(false)},
      ].map(({active,close},idx)=>
        active ? <SecretLock key={idx} onClose={close}/> : null
      )}

      {/* SECRET 1 — Konami: CRT terminal */}
      {secret1&&(
        <div style={{position:"fixed",inset:0,background:"#030b03",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,overflow:"hidden",pointerEvents:"none"}}>
          <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(0deg,rgba(0,0,0,.15) 0px,rgba(0,0,0,.15) 1px,transparent 1px,transparent 3px)"}}/>
          <div style={{position:"absolute",left:0,right:0,height:80,background:"linear-gradient(transparent,rgba(0,255,65,.05),transparent)",animation:"crtScan 3.5s linear infinite"}}/>
          <div style={{position:"relative",background:"#020c02",border:"2px solid #00cc33",padding:"36px 44px",maxWidth:540,width:"100%",boxShadow:"0 0 0 1px #001a00,0 0 60px rgba(0,255,65,.2)",animation:"modalIn .3s cubic-bezier(.22,1,.36,1),terminalGlow 4s ease infinite",pointerEvents:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#00cc33",opacity:.5,letterSpacing:3}}>↑↑↓↓←→←→</span>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#00cc33",opacity:.3,letterSpacing:2}}>SECRET 01/12</span>
            </div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#00e836",lineHeight:2.1,minHeight:200,marginBottom:16}}>
              {termLines.map((l,i)=>(
                <div key={i}>{l||<span style={{opacity:.15}}>·</span>}{i===termLines.length-1&&<span style={{marginLeft:2,animation:"blink .9s step-end infinite",color:"#00ff41"}}>█</span>}</div>
              ))}
            </div>
            <SecretDownloadCard dl={getSd(1)} accentColor="#00cc33" textColor="#00e836" bgColor="rgba(0,255,65,.04)" borderColor="rgba(0,255,65,.15)"/>
          </div>
        </div>
      )}

      {/* SECRET 2 — Logo 5×: glitch */}
      {secret2&&(
        <div style={{position:"fixed",inset:0,background:"#050505",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"fadeIn .15s ease",pointerEvents:"none"}}>
          <div style={{background:"#0a0a0a",border:"2px solid #e8e4d8",padding:"48px 44px",maxWidth:460,width:"100%",boxShadow:"8px 8px 0 #e03d0c",animation:"modalIn .22s cubic-bezier(.22,1,.36,1)",pointerEvents:"auto"}}>
            <div style={{position:"relative",marginBottom:10,height:80}}>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:68,fontWeight:400,color:"#e8e4d8",lineHeight:1,letterSpacing:.5,position:"absolute",top:0,left:0,zIndex:3}}>HEY YOU.</div>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:68,fontWeight:400,color:"#e03d0c",lineHeight:1,letterSpacing:.5,position:"absolute",top:0,left:0,zIndex:2,animation:"glitch1 2.4s steps(1) infinite",mixBlendMode:"screen"}}>HEY YOU.</div>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:68,fontWeight:400,color:"#0ff",lineHeight:1,letterSpacing:.5,position:"absolute",top:0,left:0,zIndex:1,animation:"glitch2 3.1s steps(1) infinite",mixBlendMode:"screen",opacity:.6}}>HEY YOU.</div>
            </div>
            <div style={{fontSize:9,color:"#444",marginBottom:20,fontFamily:"'IBM Plex Mono',monospace",letterSpacing:3}}>SECRET 02/12 — LOGO SEQUENCE</div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:"#666",lineHeight:1.9,marginBottom:20}}>you've cracked the first layer. the vault is awake.<br/>symbols surround you in the interface. some are more present than others.<br/>the marked one at the top watches. press it. five times. do not hesitate between presses.</p>
            <SecretDownloadCard dl={getSd(2)} accentColor="#e03d0c" textColor="#e8e4d8" bgColor="rgba(255,255,255,.03)" borderColor="rgba(255,255,255,.08)"/>
          </div>
        </div>
      )}

      {/* SECRET 3 — Hold title: core breach */}
      {secret3&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"fadeIn .2s ease",pointerEvents:"none"}}>
          {[0,.5,1].map(d=><div key={d} style={{position:"absolute",borderRadius:"50%",width:240,height:240,border:"1px solid rgba(255,140,0,.4)",pointerEvents:"none",animation:`radarPing 2.4s ease-out ${d}s infinite`}}/>)}
          <div style={{position:"relative",zIndex:10,background:"#0d0a06",border:"2px solid #ff8c00",padding:"40px 44px",maxWidth:460,width:"100%",boxShadow:"0 0 80px rgba(255,140,0,.15),8px 8px 0 #e03d0c",animation:"modalIn .28s cubic-bezier(.22,1,.36,1)",pointerEvents:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#ff8c00",letterSpacing:2,animation:"scanPulse 1.6s ease infinite"}}>◉ SIGNAL DETECTED</span>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#ff8c00",opacity:.4,letterSpacing:2}}>SECRET 03/12</span>
            </div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:56,fontWeight:400,color:"#ff8c00",lineHeight:1,marginBottom:20,letterSpacing:.5,animation:"vaultReveal .5s ease both"}}>FOUND<br/>ONE.</div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#7a6a55",lineHeight:1.9,marginBottom:18}}>{`the vault sees those who repeat. it has revealed a layer.<br/>now look at what sits largest. what commands the page.<br/>place your hand upon it. not in clicking. in lingering. in pressure. make the vault listen through your stillness.`}</p>
            <SecretDownloadCard dl={getSd(3)} accentColor="#ff8c00" textColor="#e8d0aa" bgColor="rgba(255,140,0,.04)" borderColor="rgba(255,140,0,.18)"/>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#4a3a25",letterSpacing:1}}>SIG/NOISE: 47.3dB · {new Date().toISOString().slice(0,19).replace("T"," ")}Z</div>
          </div>
        </div>
      )}

      {/* SECRET 4 — Type "open": vault door */}
      {secret4&&(
        <div style={{position:"fixed",inset:0,background:"rgba(8,6,3,.95)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"fadeIn .25s ease",pointerEvents:"none"}}>
          <div style={{background:"#111008",border:"3px solid #7a6a44",padding:"40px 44px",maxWidth:500,width:"100%",boxShadow:"0 0 0 6px #1a1508,0 0 80px rgba(200,168,75,.12),10px 10px 0 #000",animation:"modalIn .4s cubic-bezier(.22,1,.36,1)",position:"relative",pointerEvents:"auto"}}>
            <div style={{position:"absolute",top:18,right:18,width:52,height:52,borderRadius:"50%",border:"3px solid #4a3a22",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:18,height:18,borderRadius:"50%",background:"radial-gradient(circle,#3a2a14,#1a1008)",border:"2px solid #4a3a22"}}/>
            </div>
            <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#c8a84b",opacity:.6,letterSpacing:2}}>☐ VAULT UNLOCKED — SECRET 04/12</span>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:60,fontWeight:400,lineHeight:1,letterSpacing:.5,margin:"18px 0",animation:"vaultGlow 2.5s ease infinite"}}><span style={{color:"#c8a84b"}}>OPEN.</span></div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#6a5a3a",lineHeight:1.9,marginBottom:18}}>patience breaks the interface. the vault responds to those who refuse to let go.<br/>now it hungers for sound. for words. there is a command that opens doors.<br/>four letters. simple. you say it every time you enter. speak it to the void. anywhere on the page. the vault will hear.</p>
            <SecretDownloadCard dl={getSd(4)} accentColor="#c8a84b" textColor="#e8e0cc" bgColor="rgba(200,168,75,.04)" borderColor="rgba(200,168,75,.2)"/>
          </div>
        </div>
      )}

      {/* SECRET 5 — Stats 5×: classified dossier */}
      {secret5&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"fadeIn .2s ease",pointerEvents:"none"}}>
          <div style={{background:"#fdf9f0",border:"1px solid #c8b888",padding:"44px 44px 36px",maxWidth:480,width:"100%",position:"relative",overflow:"hidden",boxShadow:"10px 10px 0 #111",animation:"modalIn .25s cubic-bezier(.22,1,.36,1)",pointerEvents:"auto"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:6,background:"#b40000"}}/>
            <div style={{position:"absolute",top:36,right:28,fontFamily:"'Anton',sans-serif",fontSize:24,color:"rgba(180,0,0,.75)",border:"4px solid rgba(180,0,0,.65)",padding:"5px 12px",transform:"rotate(-12deg)",letterSpacing:3,animation:"stampDrop .45s cubic-bezier(.22,1,.36,1) .15s both"}}>CLASSIFIED</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#888",marginBottom:16,letterSpacing:2}}>VAULT INTERNAL · EYES ONLY · SECRET 05/12</div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:26,color:"#1a1008",letterSpacing:.3,lineHeight:1.2,marginBottom:20}}>INTERNAL<br/>STATISTICS</div>
            <div style={{height:1,background:"#d0c8a8",marginBottom:16}}/>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#333",lineHeight:2.4,marginBottom:16}}>
              <div>programs live: <strong style={{color:"#1a1008"}}>{progs.length}</strong></div>
              <div>total downloads: <strong style={{color:"#1a1008"}}>{progs.reduce((a,p)=>a+(p.dl||0),0)}</strong></div>
              <div>total likes: <strong style={{color:"#1a1008"}}>{progs.reduce((a,p)=>a+(p.likes||0),0)}</strong></div>
              <div>most downloaded: <strong style={{color:"#b40000"}}>{topProg?.name||"—"}</strong></div>
              <div>secrets found: <strong style={{color:"#b40000"}}>{foundSecrets.length}/10</strong></div>
            </div>
            <div style={{height:1,background:"#d0c8a8",marginBottom:16}}/>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#444",lineHeight:1.8,marginBottom:16}}>words open the vault. but the vault keeps records.<br/>numbers live in the interface. they tell stories. they count.<br/>find one of these counters. click it. five times. rapid. urgent. the vault remembers patterns.</div>
            <SecretDownloadCard dl={getSd(5)} accentColor="#b40000" textColor="#1a1008" bgColor="rgba(180,0,0,.04)" borderColor="rgba(180,0,0,.15)"/>
          </div>
        </div>
      )}

      {/* SECRET 6 — Footer Alt-trace: faultline */}
      {secret6&&(
        <div style={{position:"fixed",bottom:64,left:"50%",zIndex:9000,animation:"ghostFadeIn .5s ease both, ghostFloat 3s ease .5s infinite",pointerEvents:"none"}}>
          <div style={{background:"rgba(10,10,10,.97)",border:"1px solid #2a2a2a",padding:"20px 28px",minWidth:260,boxShadow:"0 -8px 40px rgba(0,0,0,.7)",pointerEvents:"auto"}}>
            <div style={{fontSize:9,color:"#444",marginBottom:10,letterSpacing:2}}>SECRET 06/12 · FOOTER</div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:24,color:"#e8e4d8",marginBottom:10,letterSpacing:.3}}>still here?</div>
            <p style={{fontSize:11,color:"#555",lineHeight:1.85,marginBottom:getSd(6)?.enabled&&getSd(6)?.name?14:0}}>the vault counts. it remembers rapid clicks. you've found the rhythm.<br/>there is a name at the bottom of all things.<br/>one key on your keyboard holds power. the key marked ALT. combine it with presence. hover over the vault's name at the bottom while holding ALT. wait. the vault speaks to the modified.</p>
            <SecretDownloadCard dl={getSd(6)} accentColor="#888" textColor="#ccc" bgColor="rgba(255,255,255,.03)" borderColor="rgba(255,255,255,.07)"/>
          </div>
          <div style={{position:"absolute",bottom:-8,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"8px solid transparent",borderRight:"8px solid transparent",borderTop:"8px solid #2a2a2a"}}/>
        </div>
      )}

      {/* SECRET 7 — Card Fault: hold program title */}
      {secret7&&(
        <div style={{position:"fixed",inset:0,background:"#05050a",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"fadeIn .08s ease",pointerEvents:"none"}}>
          <div style={{background:"#09090f",border:"2px solid #7c3aed",padding:"48px 44px",maxWidth:520,width:"100%",animation:"modalIn .15s cubic-bezier(.22,1,.36,1)",textAlign:"center",fontFamily:"'Courier New',monospace",pointerEvents:"auto"}}>
            <div style={{fontSize:9,color:"#8b5cf6",marginBottom:24,letterSpacing:3}}>SECRET 07/12 — CARD FAULT</div>
            <div style={{border:"3px dashed #777",width:80,height:80,margin:"0 auto 28px",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontSize:24,color:"#7c3aed",lineHeight:1,animation:"scanPulse 1.1s ease infinite"}}>!</div>
            </div>
            <div style={{fontSize:18,color:"#fff",marginBottom:8,lineHeight:1.7,fontWeight:"bold"}}>{s7CardName||"UNKNOWN PROGRAM"}</div>
            <div style={{fontSize:13,color:"#aaa",lineHeight:2.1,marginBottom:24}}>
              the vault has learned your modifier keys. it respects your patience.<br/>
              programs display within cards. each card has a title. a name.<br/>
              find any program. find its title. hold down your mouse. don't release. make the card know you're there. the vault will crack for those who apply sustained pressure to its words.
            </div>
            <SecretDownloadCard dl={getSd(7)} accentColor="#7c3aed" textColor="#fff" bgColor="rgba(124,58,237,.06)" borderColor="rgba(124,58,237,.14)"/>
          </div>
        </div>
      )}

      {/* SECRET 8 — Debug Probe: search for debug */}
      {secret8&&(
        <div style={{position:"fixed",inset:0,background:"#0d0019",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"fadeIn .2s ease",pointerEvents:"none"}}>
          <div style={{position:"relative",background:"#070617",border:"1px solid rgba(126,34,206,.4)",padding:"42px 40px",maxWidth:500,width:"100%",boxShadow:"0 0 0 1px rgba(126,34,206,.15),0 0 40px rgba(99,102,241,.18)",animation:"modalIn .2s cubic-bezier(.22,1,.36,1)",pointerEvents:"auto"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"rgba(164,140,255,.75)",letterSpacing:3,marginBottom:18}}>SECRET 08/12 — DEBUG PROBE</div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:42,color:"#c4b5fd",lineHeight:1,letterSpacing:.4,marginBottom:18}}>DEBUG</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#c7d2fe",lineHeight:1.85,marginBottom:24}}>
              you've made the vault's text respond. cards break when you hold their words.<br/>
              searching is natural. most use the search to find. but what do you search for in a vault?<br/>
              there is a word. it means to fix broken things. to investigate. to probe. type it in the search. the vault will respond to diagnostic queries.
            </div>
            <SecretDownloadCard dl={getSd(8)} accentColor="#a78bfa" textColor="#eef2ff" bgColor="rgba(167,139,250,.06)" borderColor="rgba(167,139,250,.18)"/>
          </div>
        </div>
      )}

      {/* SECRET 9 — Schema Override: shift-click theme toggle */}
      {secret9&&(
        <div style={{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"fadeIn .04s ease",background:"#020814",pointerEvents:"none"}}>
          <div style={{position:"relative",background:"#08101f",border:"1px solid rgba(56,189,248,.25)",padding:"44px",maxWidth:520,width:"100%",boxShadow:"0 0 0 1px rgba(56,189,248,.12),0 0 80px rgba(56,189,248,.14)",animation:"modalIn .1s cubic-bezier(.22,1,.36,1)",pointerEvents:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#38bdf8",letterSpacing:2,animation:"scanPulse .4s ease infinite"}}>SCHEMA OVERRIDE</span>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#7dd3fc",letterSpacing:2}}>SECRET 09/12</span>
            </div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:52,fontWeight:400,color:"#7dd3fc",lineHeight:.95,letterSpacing:.5,marginBottom:10,textShadow:"0 0 30px rgba(125,211,252,.35)"}}>OVERRIDE</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#93c5fd",lineHeight:1.6,marginBottom:18,letterSpacing:3}}>SHIFT + CLICK THE THEME BUTTON</div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#cfe8ff",lineHeight:1.9,marginBottom:20}}>
              diagnostic words exposed the vault's insides. it knows you're searching now.<br/>
              there is a button. it controls how you perceive. light and dark. inverted states.<br/>
              but buttons listen to whispers. hold down the shift key. the one that modifies. then click the perception button. speak to it in a tongue it doesn't expect.
            </p>
            <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"center"}}>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#38bdf8",letterSpacing:1}}>OVERRIDE</span>
              {["I","II","III","IV","V"].map((rank,i)=>(
                <div key={rank} style={{width:32,height:32,border:`2px solid ${i===4?"#7dd3fc":"#2563eb"}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Anton',sans-serif",fontSize:16,color:i===4?"#7dd3fc":"#38bdf8",boxShadow:i===4?"0 0 12px rgba(125,211,252,.35)":"none",background:i===4?"rgba(125,211,252,.08)":"none"}}>
                  {rank}
                </div>
              ))}
            </div>
            <SecretDownloadCard dl={getSd(9)} accentColor="#38bdf8" textColor="#eef2ff" bgColor="rgba(56,189,248,.05)" borderColor="rgba(56,189,248,.2)"/>
          </div>
        </div>
      )}

      {/* SECRET 10 — Schema flip: theme toggle rush */}
      {secret10&&(
        <div style={{position:"fixed",inset:0,background:isDark?"#1b1212":"#f7f1e8",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"themeFlash .4s ease both",pointerEvents:"none"}}>
          <div style={{background:th.card,border:th.bdr,padding:"44px 44px",maxWidth:480,width:"100%",boxShadow:`8px 8px 0 ${th.blk}`,animation:"themeGlitch .3s ease both, modalIn .25s cubic-bezier(.22,1,.36,1)",pointerEvents:"auto"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:th.mut,marginBottom:20,letterSpacing:3}}>SECRET 10/12 — SCHEMA FLIP</div>
            <div style={{position:"relative",marginBottom:16}}>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:52,fontWeight:400,color:th.blk,lineHeight:1,letterSpacing:.5}}>SCHEMA<br/>FRACTURE</div>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:52,fontWeight:400,color:"#e03d0c",lineHeight:1,letterSpacing:.5,position:"absolute",top:0,left:0,animation:"glitch1 1.8s steps(1) infinite",mixBlendMode:"multiply",opacity:.7}}>SCHEMA<br/>FRACTURE</div>
            </div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.mut,letterSpacing:2,marginBottom:16}}>ERR_SCHEMA_OVERFLOW · 10 flips / 3s</div>
              <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:th.mut,lineHeight:1.9,marginBottom:20}}>
              the button spoke to you in a modified tongue. the schema inverted. the vault doubts itself now.<br/>
              that same button still sits in the header. waiting.<br/>
              ask it to change again. and again. rapid. ten times in succession. so fast it cannot keep track. the vault will fracture when it can't remember which state it inhabits.
            </p>
            <SecretDownloadCard dl={getSd(10)} accentColor={th.org} textColor={th.blk} bgColor={th.bg} borderColor={th.div}/>
          </div>
        </div>
      )}

      {secret11&&(
        <div style={{position:"fixed",inset:0,background:isDark?"#1b1212":"#f7f1e8",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"themeFlash .4s ease both",pointerEvents:"none"}}>
          <div style={{background:th.card,border:th.bdr,padding:"44px 44px",maxWidth:480,width:"100%",boxShadow:`8px 8px 0 ${th.blk}`,animation:"themeGlitch .3s ease both, modalIn .25s cubic-bezier(.22,1,.36,1)",pointerEvents:"auto"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:th.mut,marginBottom:20,letterSpacing:3}}>SECRET 11/12 — DATA CASCADE</div>
            <div style={{position:"relative",marginBottom:16}}>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:52,fontWeight:400,color:th.blk,lineHeight:1,letterSpacing:.5}}>CASCADE<br/>TRIGGERED</div>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:52,fontWeight:400,color:"#e03d0c",lineHeight:1,letterSpacing:.5,position:"absolute",top:0,left:0,animation:"glitch1 1.8s steps(1) infinite",mixBlendMode:"multiply",opacity:.7}}>CASCADE<br/>TRIGGERED</div>
            </div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.mut,letterSpacing:2,marginBottom:16}}>ERR_RIGHT_CLICK_DETECTED · 2s HOLD</div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:th.mut,lineHeight:1.9,marginBottom:20}}>
              the right side of the mouse breaks barriers. cards cascade when touched wrongly.<br/>
              some cards wear badges. golden marks. stars. the vault's chosen ones.<br/>
              find one. press it. seven times. rapid. relentless. the vault will sing when its favorites are counted in rapid succession.
            </p>
            <SecretDownloadCard dl={getSd(11)} accentColor={th.org} textColor={th.blk} bgColor={th.bg} borderColor={th.div}/>
          </div>
        </div>
      )}

      {secret12&&(
        <div style={{position:"fixed",inset:0,background:isDark?"#1b1212":"#f7f1e8",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"themeFlash .4s ease both",pointerEvents:"none"}}>
          <div style={{background:th.card,border:th.bdr,padding:"44px 44px",maxWidth:480,width:"100%",boxShadow:`8px 8px 0 ${th.blk}`,animation:"themeGlitch .3s ease both, modalIn .25s cubic-bezier(.22,1,.36,1)",pointerEvents:"auto"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:th.mut,marginBottom:20,letterSpacing:3}}>SECRET 12/12 — VAULT RESONANCE</div>
            <div style={{position:"relative",marginBottom:16}}>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:52,fontWeight:400,color:th.blk,lineHeight:1,letterSpacing:.5}}>RESONANCE<br/>UNLOCKED</div>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:52,fontWeight:400,color:"#e03d0c",lineHeight:1,letterSpacing:.5,position:"absolute",top:0,left:0,animation:"glitch1 1.8s steps(1) infinite",mixBlendMode:"multiply",opacity:.7}}>RESONANCE<br/>UNLOCKED</div>
            </div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.mut,letterSpacing:2,marginBottom:16}}>ERR_FEATURED_OVERLOAD · 7 CLICKS</div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:th.mut,lineHeight:1.9,marginBottom:20}}>
              the theme button broke under rapid fire. the vault has lost its mind.<br/>
              cards display programs. everyone clicks them normally. left click. basic interaction.<br/>
              but there is another way to touch things. the right side of your mouse. press it. hold it. on a card. make the card feel pressure from an unexpected direction. the vault remembers those who violate its expectations.
            </p>
            <SecretDownloadCard dl={getSd(12)} accentColor={th.org} textColor={th.blk} bgColor={th.bg} borderColor={th.div}/>
          </div>
        </div>
      )}

      {partyConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9004,padding:20,animation:"fadeIn .2s ease",pointerEvents:"none"}}>
          <div style={{position:"relative",background:"#1a0f2e",border:"2px solid #ec4899",padding:"40px 36px",maxWidth:480,width:"100%",boxShadow:"0 0 0 4px rgba(236,72,153,.1),0 0 60px rgba(236,72,153,.2)",animation:"modalIn .3s cubic-bezier(.22,1,.36,1)",pointerEvents:"auto",borderRadius:12}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#f472b6",letterSpacing:2,marginBottom:16,textTransform:"uppercase"}}>⚠️ Epilepsy Warning</div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:32,fontWeight:400,color:"#ec4899",lineHeight:1.1,marginBottom:14,letterSpacing:.3}}>Party Mode</div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#f1a9d0",lineHeight:2,marginBottom:24}}>
              This mode activates rapid color and motion shifts. If you have epilepsy or are sensitive to flashing lights, please do not enable this feature.
            </p>
            <div style={{display:"flex",gap:12}}>
              <button onClick={()=>setPartyConfirm(false)} style={{flex:1,padding:"11px 16px",border:"1px solid #666",background:"transparent",color:"#999",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:.8,borderRadius:6,transition:"all .2s"}}>Decline</button>
              <button onClick={()=>{
                setPartyConfirm(false);
                setPartyMode(true);
                setPartySecret(true);
                if(user){
                  setPartyUnlocked(true);
                  ls.set(partyUnlockedKey(user.id), "1");
                  ls.set(partyEnabledKey(user.id), "1");
                }
                ping("Party mode activated","ok");
              }} style={{flex:1,padding:"11px 16px",border:"none",background:"#ec4899",color:"#fff",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:.8,fontWeight:600,borderRadius:6,boxShadow:"0 8px 20px rgba(236,72,153,.3)"}}>I Understand</button>
            </div>
          </div>
        </div>
      )}

      {partySecret&&(
        <div style={{position:"fixed",inset:0,background:"rgba(8,0,16,.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9005,padding:20,animation:"fadeIn .25s ease",pointerEvents:"none"}}>
          <div style={{position:"relative",background:"linear-gradient(135deg,rgba(20,4,40,.98) 0%,rgba(30,10,50,.98) 100%)",border:"2px solid #ec4899",padding:"44px 40px",maxWidth:520,width:"100%",boxShadow:"0 0 0 4px rgba(236,72,153,.08),0 0 80px rgba(236,72,153,.15),inset 0 0 40px rgba(236,72,153,.05)",animation:"modalIn .4s cubic-bezier(.22,1,.36,1)",pointerEvents:"auto",borderRadius:12}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#f1a9d0",letterSpacing:2.5,marginBottom:12,textTransform:"uppercase",fontWeight:600}}>✨ Party Mode Active</div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:40,fontWeight:400,color:"#f472b6",lineHeight:1.05,marginBottom:16,letterSpacing:.5,animation:"vaultGlow 2.2s ease infinite"}}>FREQUENCY<br/>SHIFT</div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#e9a0c8",lineHeight:2,marginBottom:28}}>
              Interface colors and motion are shifting to celebrate this discovery. Enjoy the rhythm!
            </p>
            <div style={{display:"flex",gap:12}}>
              <button onClick={()=>{setPartyMode(false);setPartySecret(false);}} style={{flex:1,padding:"12px 16px",border:"1px solid #ec4899",background:"transparent",color:"#f1a9d0",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:.8,borderRadius:6,transition:"all .2s",":hover":{background:"rgba(236,72,153,.1)"}}} onMouseEnter={(e)=>e.target.style.background="rgba(236,72,153,.1)"} onMouseLeave={(e)=>e.target.style.background="transparent"}>Stop Party</button>
              <button onClick={()=>setPartySecret(false)} style={{flex:1,padding:"12px 16px",border:"none",background:"#ec4899",color:"#fff",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:.8,fontWeight:600,borderRadius:6,boxShadow:"0 8px 20px rgba(236,72,153,.3)"}}>Keep Vibing</button>
            </div>
          </div>
        </div>
      )}

      {/* ALL 12 FOUND */}
      {allFoundModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9500,padding:20,animation:"fadeIn .3s ease",pointerEvents:"none"}}>
          <div style={{background:"#0e0b04",border:"2px solid #c8a84b",padding:"52px 48px",maxWidth:520,width:"100%",textAlign:"center",position:"relative",overflow:"hidden",boxShadow:"0 0 0 6px #1a1408,0 0 120px rgba(200,168,75,.25),14px 14px 0 #000",animation:"allFoundIn .5s cubic-bezier(.22,1,.36,1) both",pointerEvents:"auto"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,transparent,#c8a84b,#fff8dc,#c8a84b,transparent)",backgroundSize:"200% 100%",animation:"goldShimmer 2s linear infinite"}}/>
            <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:"linear-gradient(90deg,transparent,#c8a84b,#fff8dc,#c8a84b,transparent)",backgroundSize:"200% 100%",animation:"goldShimmer 2s linear infinite reverse"}}/>
            <div style={{display:"flex",gap:7,justifyContent:"center",marginBottom:28,flexWrap:"wrap"}}>
              {[0,1,2,3,4,5,6,7,8,9,10,11].map(i=>(
                <span key={i} style={{fontSize:26,color:"#c8a84b",display:"inline-block",filter:"drop-shadow(0 0 10px rgba(200,168,75,.9))",animation:`starPop .7s cubic-bezier(.22,1,.36,1) ${i*0.07}s both`}}>★</span>
              ))}
            </div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:52,fontWeight:400,letterSpacing:.5,lineHeight:1,marginBottom:8,animation:"vaultGlow 2s ease infinite"}}>
              <span style={{color:"#c8a84b"}}>ALL TWELVE.</span>
            </div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#c8a84b",opacity:.5,letterSpacing:3,marginBottom:24}}>SECRETS COMPLETE</div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#7a6a3a",lineHeight:2.1,marginBottom:28}}>
              the konami code. the logo. the title.<br/>
              the word. the stats. the footer.<br/>
              holding a program title. typing debug in search.<br/>
              shift-clicking the theme. breaking the schema.<br/>
              right-clicking a card. clicking the stars.<br/><br/>
              <span style={{color:"#c8a84b"}}>this is genuinely impressive.</span>
            </p>
            <button onClick={()=>setAllFoundModal(false)} style={{padding:"12px 32px",background:"#c8a84b",color:"#0a0800",border:"none",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,letterSpacing:2,fontWeight:500,filter:"drop-shadow(4px 4px 0 rgba(0,0,0,.5))",transition:"filter .1s, transform .1s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";e.currentTarget.style.filter="drop-shadow(5px 5px 0 rgba(0,0,0,.5))";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.filter="drop-shadow(4px 4px 0 rgba(0,0,0,.5))";}}
              onMouseDown={e=>{e.currentTarget.style.transform="translate(1px,1px)";e.currentTarget.style.filter="drop-shadow(2px 2px 0 rgba(0,0,0,.5))";}}
              onMouseUp={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";e.currentTarget.style.filter="drop-shadow(5px 5px 0 rgba(0,0,0,.5))"}}>
              CLOSE THE VAULT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}