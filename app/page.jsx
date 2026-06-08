"use client";
import { useState, useEffect, useRef } from "react";

const K = { admin:"vault_admin",progs:"vault_programs",likes:"vault_likes",
            dark:"vault_dark",lang:"vault_lang",sett:"vault_settings",found:"vault_found" };
const CATS  = ["All","Tools","Games","Utilities","Media","Dev","Other"];
const OSS   = [{id:"win",l:"Windows"},{id:"mac",l:"macOS"},{id:"lin",l:"Linux"},{id:"web",l:"Web"}];
const BLANK = {name:"",desc:"",ver:"1.0",cat:"Tools",url:"",file:null,os:[],coverImage:null,screenshots:[]};
const LANGS = [{c:"en",l:"EN"},{c:"de",l:"DE"},{c:"es",l:"ES"},{c:"no",l:"NO"},
               {c:"pt",l:"PT"},{c:"ja",l:"JA"},{c:"zh",l:"ZH"},{c:"ru",l:"RU"}];
const BLANK_DL = {name:"",desc:"",url:"",enabled:false};

const SECRET_LABELS = [
  {trigger:"Konami Code",
   hint:"↑↑↓↓←→←→ on keyboard",
   howto:"Press Up Up Down Down Left Right Left Right on your keyboard. Works anywhere on the page as long as you're not focused inside a text field."},
  {trigger:"Logo 5× clicks",
   hint:"Click the header 'Vault' logo five times quickly",
   howto:"Click the 'Vault' logo in the top-left header five times within ~1.3 seconds per click. The logo will glitch-scramble before the secret triggers."},
  {trigger:"Triple-click title",
   hint:"Triple-click the large hero title text",
   howto:"Click the big hero title ('Software I build / and give away.') three times within about 650ms. It won't visually react until the third click fires the secret."},
  {trigger:'Type "open"',
   hint:'Type the word "open" anywhere (not in a text input)',
   howto:'With keyboard focus outside of any text field, type the letters O-P-E-N. The page listens to all keypresses and buffers the last 8 characters to detect the word.'},
  {trigger:"Stats 5× clicks",
   hint:"Click the stats row (program/download counts) five times",
   howto:"Click anywhere on the stats row under the hero subtitle — the row showing program count, download count, and featured count — five times within ~1.5 seconds each."},
  {trigger:"Footer hover 3s",
   hint:'Hover your mouse over "Vault" in the footer for 3 full seconds',
   howto:"Move your mouse over the 'Vault' text in the bottom-left footer and hold it there without moving off for 3 solid seconds. A ghost tooltip pops up from below."},
  {trigger:"Undertale: Examine",
   hint:"Right-click any program card and choose nothing — just open and close the menu",
   howto:"Right-click anywhere on a program card (not on a link or button). The page intercepts the contextmenu event and shows the Undertale 'Check' screen. The browser context menu won't appear."},
  {trigger:"Deltarune: Scroll Rush",
   hint:"Scroll to the very bottom of the page 3 times in a row quickly",
   howto:"Scroll all the way to the bottom of the page, then back up, then back to the bottom — do this 3 times. Each time you hit the bottom it counts. All three must happen within 12 seconds."},
  {trigger:"ULTRAKILL: Charge",
   hint:"Hold down any download button for 2 full seconds without releasing",
   howto:"Press and HOLD a download button (mousedown) for 2 full seconds without letting go or moving off. Like charging the Feedbacker. Release and the machine wakes."},
  {trigger:"Theme Spammer",
   hint:"Click the light/dark mode toggle 10 times rapidly",
   howto:"Click the ◑/☀ theme toggle button in the header 10 times within about 3 seconds. The screen reacts to being tortured with rapid mode switching."},
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
    if(!to){setN(0);return;}
    let start=null;
    const step=ts=>{
      if(!start)start=ts;
      const p=Math.min((ts-start)/duration,1);
      setN(Math.floor((to)*(1-Math.pow(1-p,3))));
      if(p<1)requestAnimationFrame(step); else setN(to);
    };
    requestAnimationFrame(step);
  },[to]);
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
    dl:"Download ↓",dl_n:"downloads",lk:"likes",e1:"Nothing here yet — check back soon.",e2:"No results.",
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
    dl:"Herunterladen ↓",dl_n:"Downloads",lk:"Likes",e1:"Noch nichts hier.",e2:"Keine Ergebnisse.",
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
    dl:"Descargar ↓",dl_n:"descargas",lk:"me gusta",e1:"Nada todavía.",e2:"Sin resultados.",
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
    dl:"Last ned ↓",dl_n:"nedlastinger",lk:"likerklikk",e1:"Ingenting her ennå.",e2:"Ingen resultater.",
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
    dl:"Baixar ↓",dl_n:"downloads",lk:"curtidas",e1:"Nada aqui ainda.",e2:"Sem resultados.",
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
    dl:"ダウンロード ↓",dl_n:"DL",lk:"いいね",e1:"まだ何もありません。",e2:"結果がありません。",
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
    dl:"下载 ↓",dl_n:"下载",lk:"点赞",e1:"暂时没有内容。",e2:"没有搜索结果。",
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
    dl:"Скачать ↓",dl_n:"скач.",lk:"лайки",e1:"Пока ничего.",e2:"Ничего не найдено.",
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

// ── Btn: uses CSS filter drop-shadow so the shadow is glued to the element.
// When the button translates on hover/press, the shadow moves with it — no jump.
function Btn({children,v="ghost",onClick,disabled,sm,th,full,style={}}) {
  const [pressed,setPressed]=useState(false);
  const [hovered,setHovered]=useState(false);
  const bg  = v==="primary"?th.org:v==="dark"?th.blk:th.card;
  const fg  = (v==="primary"||v==="dark")?th.card:v==="danger"?th.org:th.blk;
  const bdr = v==="danger"?`2px solid ${th.org}`:th.bdr;
  const shColor = th.sh2.split(" ").slice(3).join(" ");
  const shadow = pressed
    ? `drop-shadow(1px 1px 0 ${shColor})`
    : hovered
    ? `drop-shadow(4px 4px 0 ${shColor})`
    : `drop-shadow(3px 3px 0 ${shColor})`;
  return (
    <button style={{
      padding:sm?"6px 12px":"10px 20px",width:full?"100%":"auto",
      border:bdr,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.5:1,
      fontFamily:"'IBM Plex Mono',monospace",fontSize:sm?11:12,
      display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5,
      background:bg,color:fg,filter:shadow,
      transform:pressed?"translate(1px,1px)":hovered?"translate(-1px,-1px)":"none",
      transition:"filter 0.1s ease, transform 0.1s ease",
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

// Same drop-shadow approach for ad-hoc inline buttons
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
    handlers:{onMouseEnter:()=>setHovered(true),onMouseLeave:()=>{setHovered(false);setPressed(false);},onMouseDown:()=>setPressed(true),onMouseUp:()=>setPressed(false)},
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
          DOWNLOAD ↓
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
              <img src={img} style={{width:"100%",height:72,objectFit:"cover",display:"block"}}/>
              <button onClick={()=>onRemove(i)} style={{position:"absolute",top:3,right:3,width:20,height:20,border:"none",background:"rgba(0,0,0,.6)",color:"#fff",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>
            </div>
          ))}
        </div>
      )}
      {tip&&<p style={{fontSize:10,color:th.mut,marginTop:6,fontFamily:"'IBM Plex Mono',monospace"}}>{tip}</p>}
    </div>
  );
}

function DetailModal({prog,liked,onLike,onDownload,loadingDl,onClose,th,tr}) {
  const [slide,setSlide]=useState(0);
  const [heartAnim,setHeartAnim]=useState(false);
  const dlPress=usePressStyle(th);
  const imgs=[prog.coverImage,...(prog.screenshots||[])].filter(Boolean);
  const catIdx=CATS.indexOf(prog.cat);
  const catLabel=catIdx>0?(tr.cats[catIdx]||prog.cat):prog.cat;
  const doLike=()=>{if(!liked){setHeartAnim(true);setTimeout(()=>setHeartAnim(false),420);}onLike(prog.id);};
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,padding:20}}>
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
              <button onClick={()=>onDownload(prog)} style={{flex:1,padding:"10px",background:"#e03d0c",color:th.card,border:th.bdr,cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:13,letterSpacing:.5,...dlPress.btnStyle}} {...dlPress.handlers}>
                {loadingDl===prog.id?tr.loading:tr.dl}
              </button>
            </div>
        </div>
      </div>
    </div>
  );
}

function ProgramCard({p,onDownload,onLike,liked,onDetail,loadingDl,th,tr,customDlBtn}) {
  const [hov,setHov]=useState(false);
  const [heartAnim,setHeartAnim]=useState(false);
  const dlPress=usePressStyle(th);
  const doLike=()=>{if(!liked){setHeartAnim(true);setTimeout(()=>setHeartAnim(false),420);}onLike(p.id);};
  const catIdx=CATS.indexOf(p.cat);
  const catLabel=catIdx>0?(tr.cats[catIdx]||p.cat):p.cat;
  const hasImages=p.coverImage||(p.screenshots||[]).length>0;
  const isNew=fmt.isNew(p.date);
  return(
    <article onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{
      background:th.card,border:th.bdr,display:"flex",flexDirection:"column",position:"relative",
      boxShadow:hov?"6px 6px 0 "+th.blk:th.shd,transform:hov?"translate(-2px,-2px)":"none",
      transition:"box-shadow .14s,transform .14s",
      animation:p.featured&&!hov?"featPulse 3s ease infinite":"none"}}>
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
          <span style={{fontSize:10,padding:"3px 8px",border:th.bdr,fontFamily:"'IBM Plex Mono',monospace",background:p.featured?th.blk:th.card,color:p.featured?th.card:th.blk}}>{p.featured?"★ ":""}{catLabel}</span>
          <span style={{fontSize:10,padding:"3px 7px",border:`1px solid ${th.div}`,color:th.mut,fontFamily:"'IBM Plex Mono',monospace"}}>v{p.ver||"1.0"}</span>
        </div>
        <h2 onClick={hasImages?()=>onDetail(p):undefined} style={{fontFamily:"'Anton',sans-serif",fontSize:22,fontWeight:400,letterSpacing:.3,lineHeight:1.05,marginBottom:6,color:th.blk,cursor:hasImages?"pointer":"default"}}>{p.name}</h2>
        {(p.os||[]).length>0&&(
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
            {(p.os||[]).map(o=><span key={o} style={{fontSize:9,padding:"2px 6px",border:`1px solid ${th.div}`,color:th.mut,fontFamily:"'IBM Plex Mono',monospace"}}>{OSS.find(x=>x.id===o)?.l||o}</span>)}
          </div>
        )}
        {p.desc&&<p style={{fontSize:12,color:th.mut,lineHeight:1.72,flex:1,marginBottom:14,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:p.coverImage?2:3,WebkitBoxOrient:"vertical",fontFamily:"'IBM Plex Mono',monospace"}}>{p.desc}</p>}
        {/* Like button — prominent, full-width, before download */}
        <button onClick={doLike} style={{
          width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px 0",marginBottom:8,
          border:`2px solid ${liked?"#e03d0c":"#e03d0c66"}`,
          background:liked?"#e03d0c":"transparent",
          color:liked?th.card:"#e03d0c",cursor:"pointer",
          fontFamily:"'IBM Plex Mono',monospace",fontSize:12,
          filter:`drop-shadow(2px 2px 0 ${liked?"#c5330a":"#e03d0c44"})`,
          transition:"background .12s, border-color .12s, filter 0.1s, transform 0.1s",
        }}
          onMouseEnter={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";e.currentTarget.style.filter=`drop-shadow(3px 3px 0 ${liked?"#c5330a":"#e03d0c66"})`;if(!liked)e.currentTarget.style.background="#e03d0c18";}}
          onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.filter=`drop-shadow(2px 2px 0 ${liked?"#c5330a":"#e03d0c44"})`;if(!liked)e.currentTarget.style.background="transparent";}}
          onMouseDown={e=>{e.currentTarget.style.transform="translate(1px,1px)";e.currentTarget.style.filter=`drop-shadow(1px 1px 0 ${liked?"#c5330a":"#e03d0c44"})`;}}
          onMouseUp={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";}}>
          <span style={{fontSize:18,lineHeight:1,display:"inline-block",animation:heartAnim?"heartPop .42s cubic-bezier(.22,1,.36,1) both":"none"}}>{liked?"♥":"♡"}</span>
          <span style={{fontWeight:500}}>{(p.likes||0)>0?`${fmt.n(p.likes||0)} ${tr.lk}`:tr.lk}</span>
        </button>
        <div style={{paddingTop:10,borderTop:`1px solid ${th.div}`}}>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.mut,marginBottom:8,lineHeight:1.55}}>
            {fmt.d(p.date)}{p.fileSize?` · ${fmt.b(p.fileSize)}`:""}<br/>
            {fmt.n(p.dl)} {tr.dl_n}
            {hasImages&&<span onClick={()=>onDetail(p)} style={{marginLeft:8,color:"#e03d0c",cursor:"pointer",textDecoration:"underline",fontSize:10}}>{(p.screenshots||[]).length+1} photo{((p.screenshots||[]).length+1)!==1?"s":""}</span>}
          </div>
          {customDlBtn ?? (
            <button onClick={()=>onDownload(p)} style={{width:"100%",padding:"10px 0",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,background:"#e03d0c",color:th.card,border:th.bdr,cursor:"pointer",letterSpacing:.5,...dlPress.btnStyle}} {...dlPress.handlers}>
              {loadingDl===p.id?tr.loading:tr.dl}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ── PART 2 — paste directly after Part 1 (remove the comment line at the bottom of Part 1 first) ──

// ── Storage strategy:
//    IndexedDB  → programs, settings  (handles large base64 file data, no 5MB cap)
//    localStorage → dark mode, lang, likes, found secrets  (tiny, fast, no serialisation issues)
//
//    idb: a tiny Promise wrapper around IndexedDB so we don't need a library
// ─────────────────────────────────────────────────────────────────────────────
// ── API helpers — talk to your Next.js API routes ────────────────────────────
const ADMIN_SECRET = typeof window !== "undefined"
  ? window.__VAULT_ADMIN_SECRET__ ?? ""   // set after login (see below)
  : "";

async function apiFetch(path, opts = {}) {
  const secret = window.__VAULT_ADMIN_SECRET__ ?? "";
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", "x-admin-secret": secret },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// localStorage — tiny prefs only (theme, lang, likes, found secrets, admin pw)
const ls = {
  get: (k) => { try { const v=localStorage.getItem(k); return v!=null?v:null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, String(v)); } catch {} },
};

export default function Vault() {
  const [progs,setProgs]           = useState([]);
  const [likes,setLikes]           = useState([]);
  const [sett,setSett]             = useState({ann:{text:"",type:"info",visible:false},support:{url:"",msg:"",visible:false},heroSub:"",secretDownloads:[]});
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
  const [pwErr,setPwErr]           = useState("");
  const [form,setForm]             = useState({...BLANK});
  const [uploadMode,setUploadMode] = useState("url");
  const [editId,setEditId]         = useState(null);
  const [editForm,setEditForm]     = useState({...BLANK});
  const [annDraft,setAnnDraft]     = useState({text:"",type:"info"});
  const [ppDraft,setPpDraft]       = useState({url:"",msg:"",visible:false});
  const [heroSubDraft,setHeroSubDraft] = useState("");
  const [sdDraft,setSdDraft]       = useState(Array(10).fill(null).map(()=>({...BLANK_DL})));
  const [loadingDl,setLoadingDl]   = useState(null);
  const [busy,setBusy]             = useState(false);
  const [toast,setToast]           = useState(null);
  const [delId,setDelId]           = useState(null);
  const [uploadKey,setUploadKey]   = useState(0);

  // ── 10 secrets ──
  const [secret1,setSecret1]   = useState(false); // Konami
  const [secret2,setSecret2]   = useState(false); // Logo 5×
  const [secret3,setSecret3]   = useState(false); // Triple-click title
  const [secret4,setSecret4]   = useState(false); // Type "open"
  const [secret5,setSecret5]   = useState(false); // Stats 5×
  const [secret6,setSecret6]   = useState(false); // Footer hover 3s
  const [secret7,setSecret7]   = useState(false); // Undertale: right-click card
  const [secret8,setSecret8]   = useState(false); // Deltarune: scroll-rush
  const [secret9,setSecret9]   = useState(false); // Ultrakill: hold download 2s
  const [secret10,setSecret10] = useState(false); // Theme spammer 10×
  const [s7CardName,setS7CardName] = useState(""); // name of right-clicked card
  const [chargeProgress,setChargeProgress] = useState(0); // secret9 hold progress

  const [partyMode,setPartyMode]   = useState(false);
  const [foundSecrets,setFoundSecrets] = useState([]);
  const [starAnim,setStarAnim]     = useState(null);
  const [allFoundModal,setAllFoundModal] = useState(false);
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
  const footerHoverRef = useRef(null);
  const footerClickRef = useRef(0);
  const footerTimerRef = useRef(null);
  // secret 8: scroll rush
  const scrollBottomRef  = useRef(0);
  const scrollTimerRef   = useRef(null);
  const lastScrollBottom = useRef(false);
  // secret 9: hold download
  const holdTimerRef     = useRef(null);
  const holdIntervalRef  = useRef(null);
  // secret 10: theme spam
  const themeClickRef    = useRef(0);
  const themeTimerRef    = useRef(null);

  const tr=TR[lang]||TR.en, th=isDark?THEMES.dark:THEMES.light;
  const gridKey=`${cat}|${sort}|${osFilter.join(",")}|${search}`;
  const ping=(msg,type="ok")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  // ── Block Dark Reader and similar extensions from overriding our theme ──
  useEffect(()=>{
    // 1. darkreader-lock meta: Dark Reader's own official opt-out signal
    if(!document.querySelector("meta[name='darkreader-lock']")){
      const m=document.createElement("meta");
      m.name="darkreader-lock"; document.head.appendChild(m);
    }
    // 2. color-scheme meta: tells browser/extensions which scheme we're using
    let cs=document.querySelector("meta[name='color-scheme']");
    if(!cs){cs=document.createElement("meta");cs.name="color-scheme";document.head.appendChild(cs);}
    cs.content=isDark?"dark":"light";
    // 3. Force color-scheme on root so CSS variables aren't inverted
    document.documentElement.style.colorScheme=isDark?"dark":"light";
    document.documentElement.setAttribute("data-theme",isDark?"dark":"light");
  },[isDark]);
  useEffect(()=>{
    document.title="SoftwareVault";
    // Transparent background so it looks clean in any browser tab colour
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="none" stroke="#e03d0c" stroke-width="2.5"/><circle cx="16" cy="16" r="9" fill="none" stroke="#e03d0c" stroke-width="1.5"/><circle cx="16" cy="16" r="3" fill="#e03d0c"/><line x1="16" y1="7" x2="16" y2="11" stroke="#e03d0c" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="21" x2="16" y2="25" stroke="#e03d0c" stroke-width="2" stroke-linecap="round"/><line x1="7" y1="16" x2="11" y2="16" stroke="#e03d0c" stroke-width="2" stroke-linecap="round"/><line x1="21" y1="16" x2="25" y2="16" stroke="#e03d0c" stroke-width="2" stroke-linecap="round"/></svg>`;
    const encoded="data:image/svg+xml,"+encodeURIComponent(svg);
    let link=document.querySelector("link[rel*='icon']");
    if(!link){link=document.createElement("link");link.rel="icon";document.head.appendChild(link);}
    link.type="image/svg+xml"; link.href=encoded;
  },[]);

  // ── Load from storage ──
  useEffect(()=>{
    (async()=>{
      try {
        // Admin credential — localStorage (tiny JSON)
        const adm=ls.get(K.admin); setHasAdmin(!!adm);
        // Programs + settings — IndexedDB (may contain base64 file data)
        const savedProgs=await idbGet(K.progs); if(savedProgs) setProgs(savedProgs);
        const savedSett=await idbGet(K.sett);
        if(savedSett){
          setSett(savedSett);
          setAnnDraft({text:savedSett.ann?.text||"",type:savedSett.ann?.type||"info"});
          setPpDraft({url:savedSett.support?.url||"",msg:savedSett.support?.msg||"",visible:savedSett.support?.visible||false});
          setHeroSubDraft(savedSett.heroSub||"");
          const dls=Array(10).fill(null).map((_,i)=>savedSett.secretDownloads?.[i]||{...BLANK_DL});
          setSdDraft(dls);
        }
        // Small prefs — localStorage
        const dk=ls.get(K.dark);
        if(dk!==null){ setIsDark(JSON.parse(dk)); }
        else { setIsDark(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false); }
        const lg=ls.get(K.lang); if(lg) setLang(lg.replace(/"/g,""));
        const lk=ls.get(K.likes); if(lk) setLikes(JSON.parse(lk));
        const fd=ls.get(K.found); if(fd){const f=JSON.parse(fd);foundRef.current=f;setFoundSecrets(f);}
      } catch(e){ console.error("Storage load error:",e); }
      setReady(true);
    })();
  },[]);

  useEffect(()=>{ if(ready) ls.set(K.dark,JSON.stringify(isDark)); },[isDark,ready]);
  useEffect(()=>{ if(ready) ls.set(K.lang,lang); },[lang,ready]);

  // ── Mark secret found ──
  const markSecretFound=async(n)=>{
    if(foundRef.current.includes(n)) return;
    const nf=[...foundRef.current,n];
    foundRef.current=nf; setFoundSecrets(nf);
    setStarAnim(n); setTimeout(()=>setStarAnim(null),1800);
    await Promise.resolve(ls.set(K.found,JSON.stringify(nf)));
    if(nf.length===10) setTimeout(()=>setAllFoundModal(true),2600);
  };

  // ── Secret 1: Konami + typing detector ──
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

  // ── Secret 7: Undertale — right-click any program card ──
  // Wired via onContextMenu on each card wrapper in the grid
  const handleCardRightClick=(e,prog)=>{
    e.preventDefault();
    setS7CardName(prog.name);
    setSecret7(true); markSecretFound(7); setTimeout(()=>setSecret7(false),14000);
  };

  // ── Secret 8: Deltarune — scroll to bottom 3× within 12s ──
  useEffect(()=>{
    const handleScroll=()=>{
      const atBottom=(window.innerHeight+window.scrollY)>=document.body.scrollHeight-50;
      if(atBottom&&!lastScrollBottom.current){
        lastScrollBottom.current=true;
        scrollBottomRef.current++;
        clearTimeout(scrollTimerRef.current);
        if(scrollBottomRef.current>=3){
          scrollBottomRef.current=0;
          setSecret8(true); markSecretFound(8); setTimeout(()=>setSecret8(false),14000);
        } else {
          scrollTimerRef.current=setTimeout(()=>{scrollBottomRef.current=0;lastScrollBottom.current=false;},12000);
        }
      } else if(!atBottom){
        lastScrollBottom.current=false;
      }
    };
    window.addEventListener("scroll",handleScroll,{passive:true});
    return ()=>window.removeEventListener("scroll",handleScroll);
  },[]);

  // ── Secret 9: Ultrakill — hold download button 2s ──
  // Exposed as functions called by the download button's onMouseDown/Up/Leave
  const startCharge=(e)=>{
    e.preventDefault();
    setChargeProgress(0);
    let elapsed=0;
    holdIntervalRef.current=setInterval(()=>{
      elapsed+=50;
      setChargeProgress(Math.min(100,Math.round((elapsed/2000)*100)));
    },50);
    holdTimerRef.current=setTimeout(()=>{
      clearInterval(holdIntervalRef.current);
      setChargeProgress(0);
      setSecret9(true); markSecretFound(9); setTimeout(()=>setSecret9(false),14000);
    },2000);
  };
  const cancelCharge=()=>{
    clearTimeout(holdTimerRef.current);
    clearInterval(holdIntervalRef.current);
    setChargeProgress(0);
  };

  // ── Secret 10: theme toggled 10× rapidly ──
  const handleThemeToggle=()=>{
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

  // ── Terminal typewriter for secret1 ──
useEffect(() => {
  (async () => {
    try {
      // Load programs from database (visible to everyone)
      const programs = await apiFetch("/api/programs").catch(() => []);
      setProgs(programs.map(dbToLocal));

      // Load settings
      const settings = await apiFetch("/api/settings").catch(() => ({}));
      const s = settings.sett ?? {};
      if (s && Object.keys(s).length) {
        setSett(s);
        setAnnDraft({ text: s.ann?.text || "", type: s.ann?.type || "info" });
        setPpDraft({ url: s.support?.url || "", msg: s.support?.msg || "", visible: s.support?.visible || false });
        setHeroSubDraft(s.heroSub || "");
        const dls = Array(10).fill(null).map((_, i) => s.secretDownloads?.[i] || { ...BLANK_DL });
        setSdDraft(dls);
      }
    } catch (e) { console.error("Load error:", e); }

    // Prefs from localStorage
    const dk = ls.get(K.dark);
    if (dk !== null) setIsDark(JSON.parse(dk));
    else setIsDark(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
    const lg = ls.get(K.lang); if (lg) setLang(lg);
    const lk = ls.get(K.likes); if (lk) setLikes(JSON.parse(lk));
    const fd = ls.get(K.found); if (fd) { const f=JSON.parse(fd); foundRef.current=f; setFoundSecrets(f); }
    const adm = ls.get(K.admin); setHasAdmin(!!adm);

    setReady(true);
  })();
}, []);

  // ── Logo scramble (secret 2) ──
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

  // ── Triple-click hero title (secret 3) ──
  const handleHeroTitleClick=()=>{
    heroClickRef.current++;
    clearTimeout(heroTimerRef.current);
    if(heroClickRef.current>=3){heroClickRef.current=0;setSecret3(true);markSecretFound(3);setTimeout(()=>setSecret3(false),10000);}
    else heroTimerRef.current=setTimeout(()=>{heroClickRef.current=0;},650);
  };

  // ── Footer year clicks → party mode (fun, not a secret) ──
  const handleFooterYearClick=()=>{
    footerClickRef.current++;
    clearTimeout(footerTimerRef.current);
    if(footerClickRef.current>=5){
      footerClickRef.current=0;
      setPartyMode(true); ping("✦ party mode","ok");
      clearTimeout(partyTimerRef.current);
      partyTimerRef.current=setTimeout(()=>setPartyMode(false),4500);
    } else footerTimerRef.current=setTimeout(()=>{footerClickRef.current=0;},1200);
  };

  // ── Footer hover 3s (secret 6) ──
  const handleFooterVaultEnter=()=>{
    footerHoverRef.current=setTimeout(()=>{setSecret6(true);markSecretFound(6);setTimeout(()=>setSecret6(false),8000);},3000);
  };
  const handleFooterVaultLeave=()=>clearTimeout(footerHoverRef.current);

  // ── Stats 5× clicks (secret 5) ──
  const handleStatsClick=()=>{
    statsClickRef.current++;
    clearTimeout(statsTimerRef.current);
    if(statsClickRef.current>=5){statsClickRef.current=0;setSecret5(true);markSecretFound(5);setTimeout(()=>setSecret5(false),12000);}
    else statsTimerRef.current=setTimeout(()=>{statsClickRef.current=0;},1500);
  };

  // ── Storage helpers ──
  const saveProgs = async (list) => {
  // We don't bulk-save to API — individual operations handle their own calls.
  // Just update local state.
  setProgs(list);
  };

  const saveSett = async (s) => {
    setSett(s);
    // Persist each changed section to the API
    await apiFetch("/api/settings", {
      method: "POST",
      body: JSON.stringify({ key: "sett", value: s }),
    });
  };
  const saveSecretDownload=async(idx)=>{
    const s={...sett,secretDownloads:[...sdDraft]};
    await saveSett(s); ping(`Secret #${idx+1} saved.`);
  };
  const updateSd=(idx,field,value)=>setSdDraft(d=>{const a=[...d];a[idx]={...a[idx],[field]:value};return a;});

  // ── Auth ──
  const login = async () => {
    setPwErr("");
    const raw = ls.get(K.admin);
    if (!raw) { setPwErr("No account on this device."); return; }
    const saved = JSON.parse(raw);
    if (pw === saved.pw) {
      window.__VAULT_ADMIN_SECRET__ = saved.apiSecret;
      setIsAdmin(true); setPage("admin"); setAdminTab("programs");
      setModal(null); setPw("");
    } else setPwErr("Wrong password.");
  };
  const setupAdmin = async () => {
    setPwErr("");
    if (pw.length < 6) { setPwErr("At least 6 characters."); return; }
    if (pw !== pw2)    { setPwErr("Those don't match."); return; }
    // Prompt for the ADMIN_SECRET from your .env / Vercel env vars
    const apiSecret = prompt("Enter your ADMIN_SECRET from your environment variables:");
    if (!apiSecret) { setPwErr("API secret is required."); return; }
    ls.set(K.admin, JSON.stringify({ pw, apiSecret }));
    window.__VAULT_ADMIN_SECRET__ = apiSecret;
    setHasAdmin(true); setIsAdmin(true); setPage("admin");
    setAdminTab("programs"); setModal(null); setPw(""); setPw2("");
    ping("You're in.");
  };
  const changePw=async()=>{
    setPwErr("");
    if(pw.length<6){setPwErr("At least 6 characters.");return;}
    if(pw!==pw2){setPwErr("Those don't match.");return;}
    ls.set(K.admin,JSON.stringify({pw}));
    setModal(null);setPw("");setPw2("");ping("Password updated.");
  };

  // ── Image helpers ──
  const processCoverImage=async(file)=>{try{return await compressImage(file,900,0.80);}catch{return null;}};
  const processScreenshot=async(file)=>{try{return await compressImage(file,1100,0.80);}catch{return null;}};

  // ── Upload / edit ──
  const upload = async () => {
    if (!form.name.trim()) { ping("Give it a name.", "err"); return; }
    setBusy(true);
    try {
      let fileUrl = null, filePath = null, fileName = null, fileSize = null;

      if (uploadMode === "file" && form.file) {
        // Upload file to Supabase Storage via our API route
        const fd = new FormData();
        fd.append("file", form.file);
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "x-admin-secret": window.__VAULT_ADMIN_SECRET__ ?? "" },
          body: fd,
        });
        if (!res.ok) throw new Error("Upload failed");
        const uploaded = await res.json();
        fileUrl  = uploaded.url;
        filePath = uploaded.path;
        fileName = uploaded.name;
        fileSize = uploaded.size;
      }

      const payload = {
        id:         Date.now().toString(),
        name:       form.name.trim(),
        desc:       form.desc.trim(),
        ver:        form.ver || "1.0",
        cat:        form.cat,
        os:         form.os || [],
        featured:   false,
        likes:      0,
        dl:         0,
        url:        uploadMode === "url" ? form.url.trim() : fileUrl,
        file_path:  filePath,
        file_name:  fileName,
        file_size:  fileSize,
        cover_url:  form.coverImage || null,
        screenshots: form.screenshots || [],
        date:       new Date().toISOString(),
      };

      const saved = await apiFetch("/api/programs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setProgs(p => [dbToLocal(saved), ...p]);
      setForm({ ...BLANK });
      if (fileRef.current) fileRef.current.value = "";
      setUploadKey(k => k + 1);
      ping("Added.");
    } catch (e) {
      ping("Something went wrong: " + e.message, "err");
    }
    setBusy(false);
  };
  const toggleFeatured = async (id) => {
    const prog = progs.find(p => p.id === id);
    const next = !prog.featured;
    await apiFetch("/api/programs", { method: "PUT", body: JSON.stringify({ id, featured: next }) });
    setProgs(ps => ps.map(p => p.id === id ? { ...p, featured: next } : p));
    ping(next ? "Pinned." : "Unpinned.");
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) { ping("Name required.", "err"); return; }
    const payload = {
      id:          editId,
      name:        editForm.name.trim(),
      desc:        editForm.desc.trim(),
      ver:         editForm.ver,
      cat:         editForm.cat,
      os:          editForm.os || [],
      url:         editForm.url || null,
      cover_url:   editForm.coverImage || null,
      screenshots: editForm.screenshots || [],
    };
    const saved = await apiFetch("/api/programs", { method: "PUT", body: JSON.stringify(payload) });
    setProgs(ps => ps.map(p => p.id === editId ? { ...p, ...dbToLocal(saved) } : p));
    setModal(null); setEditId(null); ping("Saved.");
  };
  const remove = async (id) => {
    await apiFetch(`/api/programs?id=${id}`, { method: "DELETE" });
    setProgs(ps => ps.filter(p => p.id !== id));
    setDelId(null); ping("Removed.");
  };
  const download = async (prog) => {
    setLoadingDl(prog.id);
    // Increment download count via API
    apiFetch("/api/programs", {
      method: "PUT",
      body: JSON.stringify({ id: prog.id, dl: (prog.dl || 0) + 1 }),
    }).catch(() => {});
    setProgs(ps => ps.map(p => p.id === prog.id ? { ...p, dl: (p.dl||0)+1 } : p));

    const target = prog.url || prog.fileUrl;
    if (target) window.open(target, "_blank");
    setLoadingDl(null);
    if (detailProg?.id === prog.id) setDetailProg({ ...detailProg, dl: (detailProg.dl||0)+1 });
  };
  const handleLike = async (id) => {
    const had = likes.includes(id);
    const nl  = had ? likes.filter(x => x !== id) : [...likes, id];
    const delta = had ? -1 : 1;
    setLikes(nl);
    ls.set(K.likes, JSON.stringify(nl));
    setProgs(ps => ps.map(p => p.id === id ? { ...p, likes: Math.max(0, (p.likes||0)+delta) } : p));
    apiFetch("/api/programs", {
      method: "PUT",
      body: JSON.stringify({ id, likes: Math.max(0, (progs.find(p=>p.id===id)?.likes||0)+delta) }),
    }).catch(() => {});
    if (detailProg?.id === id) setDetailProg(d => ({ ...d, likes: Math.max(0,(d.likes||0)+delta) }));
  };
  const saveAnn=async()=>{const s={...sett,ann:{...annDraft,visible:true}};await saveSett(s);ping("Saved.");};
  const clearAnn=async()=>{const s={...sett,ann:{text:"",type:"info",visible:false}};await saveSett(s);setAnnDraft({text:"",type:"info"});ping("Cleared.");};
  const saveSupport=async()=>{const s={...sett,support:{...ppDraft}};await saveSett(s);ping("Saved.");};
  const saveHeroSub=async()=>{const s={...sett,heroSub:heroSubDraft};await saveSett(s);ping("Saved.");};

  // ── Filter / sort ──
  let vis=[...progs].filter(p=>{
    const mc=cat==="All"||p.cat===cat;
    const ms=!search||p.name.toLowerCase().includes(search.toLowerCase())||(p.desc||"").toLowerCase().includes(search.toLowerCase());
    const mo=osFilter.length===0||osFilter.some(o=>(p.os||[]).includes(o));
    return mc&&ms&&mo;
  });
  if(sort==="popular") vis.sort((a,b)=>(b.dl||0)-(a.dl||0));
  else if(sort==="az") vis.sort((a,b)=>a.name.localeCompare(b.name));
  else vis.sort((a,b)=>new Date(b.date)-new Date(a.date));
  const featVis=vis.filter(p=>p.featured), regVis=vis.filter(p=>!p.featured);
  const totalDl=progs.reduce((a,p)=>a+(p.dl||0),0);
  const topProg=[...progs].sort((a,b)=>(b.dl||0)-(a.dl||0))[0];
  const ann=sett.ann||{}, sup=sett.support||{}, annC=th.annC[ann.type]||th.annC.info;
  const getSd=(n)=>sett.secretDownloads?.[n-1];

  const inp={width:"100%",padding:"10px 12px",border:th.bdr,background:th.inputBg,color:th.blk,fontFamily:"'IBM Plex Mono',monospace",fontSize:13,outline:"none",boxSizing:"border-box"};
  const lbl={fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.mut,display:"block",marginBottom:6};

  if(!ready) return(
    <div style={{minHeight:"100vh",background:"#f0ece0",display:"flex",alignItems:"center",justifyContent:"center",gap:14}}>
      <svg width="32" height="32" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{animation:"spin 2s linear infinite"}}>
        <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
        <circle cx="14" cy="14" r="13" stroke="#e03d0c" strokeWidth="2"/>
        <circle cx="14" cy="14" r="2.5" fill="#e03d0c"/>
        <line x1="14" y1="6" x2="14" y2="10" stroke="#e03d0c" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="18" y1="14" x2="22" y2="14" stroke="#e03d0c" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:2}}>
        <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:3,color:"#999",textTransform:"uppercase"}}>Software</span>
        <span style={{fontFamily:"'Anton',sans-serif",fontSize:24,letterSpacing:.5,color:"#111"}}>Vault</span>
      </div>
    </div>
  );

  // Card wrapper: intercepts right-click (secret 7) + passes charge-download button (secret 9)
  const CardWithSecrets=({p,...rest})=>(
    <div onContextMenu={e=>handleCardRightClick(e,p)}>
      <ProgramCard p={p} {...rest} customDlBtn={<ChargeDownloadBtn prog={p}/>}/>
    </div>
  );

  // Download button with 2s hold = Ultrakill secret, quick click = normal download
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
          // Still download after the secret fires
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
        {/* Charge fill bar */}
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
    <div id="sv-root" style={{minHeight:"100vh",background:th.bg,color:th.blk,fontFamily:"'IBM Plex Mono','Courier New',monospace",animation:partyMode?"partyShift .65s linear infinite":"none"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@400;500&display=swap');
        /* ── Block Dark Reader & similar extensions ───────────────────────────── */
        /* color-scheme tells the browser which native controls to use and signals
           to Dark Reader that this page manages its own theme — do not invert.   */
        :root { color-scheme: ${isDark?"dark":"light"} !important; }
        /* Blanket override: re-apply our explicit colours so filters can't win.
           Dark Reader injects a filter on <html> — we cancel it on our root div. */
        #sv-root {
          filter: none !important;
          background-color: ${th.bg} !important;
          color: ${th.blk} !important;
        }
        /* Force all backgrounds and text to be explicit so Dark Reader
           has nothing "transparent" or "inherit" to guess at. */
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:#aaa}
        @keyframes heroReveal{from{transform:translateY(108%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
        @keyframes heartPop{0%{transform:scale(1)}30%{transform:scale(1.55)}65%{transform:scale(.88)}100%{transform:scale(1)}}
        @keyframes statSlide{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes annSlide{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}
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
        @keyframes bloodDrip{0%{transform:scaleY(0);transform-origin:top;opacity:1}100%{transform:scaleY(1);transform-origin:top;opacity:1}}
        @keyframes mercyFlicker{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes newPulse{0%,100%{opacity:1}50%{opacity:.6}}
        @keyframes themeFlash{0%{opacity:1}25%{opacity:.1}50%{opacity:.9}75%{opacity:.05}100%{opacity:1}}
        @keyframes themeGlitch{0%,100%{transform:none}20%{transform:translate(3px,-2px)}40%{transform:translate(-3px,1px)}60%{transform:translate(2px,3px)}80%{transform:translate(-1px,-3px)}}
        @keyframes scrollRushIn{from{opacity:0;transform:translateY(30px) scale(.96)}to{opacity:1;transform:none}}
        input:focus,textarea:focus,select:focus{outline:2px solid #e03d0c!important;outline-offset:-1px}
        select option{background:${th.inputBg};color:${th.blk}}
      `}</style>

      {toast&&(
        <div style={{position:"fixed",top:20,right:20,zIndex:9999,padding:"10px 18px",border:th.bdr,background:toast.type==="err"?th.blk:th.card,color:toast.type==="err"?th.card:th.blk,fontFamily:"'IBM Plex Mono',monospace",fontSize:12,filter:"drop-shadow(3px 3px 0 rgba(0,0,0,.3))",animation:"fadeIn .15s ease"}}>
          {toast.msg}
        </div>
      )}

      {ann.visible&&ann.text&&(
        <div style={{background:annC.bg,borderBottom:`2px solid ${annC.b}`,padding:"11px 40px",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:annC.t,textAlign:"center",lineHeight:1.6,animation:"annSlide .35s cubic-bezier(.22,1,.36,1) both"}}>
          {ann.text}
        </div>
      )}

      <header style={{padding:"14px 40px",borderBottom:`1px solid ${th.div}`,background:th.heroBg,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:200,gap:10,flexWrap:"wrap"}}>
        {/* ── Logo ── */}
        <button onClick={handleLogoClick} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          {/* Vault dial icon */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="13" stroke="#e03d0c" strokeWidth="2"/>
            <circle cx="14" cy="14" r="8.5" stroke={th.blk} strokeWidth="1.5" opacity="0.35"/>
            <circle cx="14" cy="14" r="2.5" fill="#e03d0c"/>
            {/* spokes */}
            <line x1="14" y1="6" x2="14" y2="10" stroke="#e03d0c" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="14" y1="18" x2="14" y2="22" stroke="#e03d0c" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="6" y1="14" x2="10" y2="14" stroke="#e03d0c" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="18" y1="14" x2="22" y2="14" stroke="#e03d0c" strokeWidth="1.5" strokeLinecap="round"/>
            {/* handle */}
            <circle cx="14" cy="4.5" r="1.5" fill="#e03d0c" opacity="0.6"/>
          </svg>
          {/* Wordmark: "Software" small + "Vault" bold */}
          <span style={{display:"flex",flexDirection:"column",lineHeight:1,gap:1,textAlign:"left"}}>
            <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:3,color:th.mut,textTransform:"uppercase"}}>Software</span>
            <span style={{fontFamily:"'Anton',sans-serif",fontSize:20,letterSpacing:.5,color:th.blk}}>{logoDisplay==="SoftwareVault"?"Vault":logoDisplay}</span>
          </span>
        </button>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <select value={lang} onChange={e=>setLang(e.target.value)} style={{padding:"5px 8px",border:th.bdr,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,background:th.inputBg,color:th.blk,cursor:"pointer",filter:"drop-shadow(2px 2px 0 "+th.sh2.split(" ").slice(3).join(" ")+")"}}>
            {LANGS.map(l=><option key={l.c} value={l.c}>{l.l}</option>)}
          </select>
          <button onClick={handleThemeToggle} style={{width:34,height:34,border:th.bdr,background:th.card,color:th.blk,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",filter:"drop-shadow(2px 2px 0 "+th.sh2.split(" ").slice(3).join(" ")+")",transition:"filter 0.1s, transform 0.1s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";e.currentTarget.style.filter="drop-shadow(3px 3px 0 "+th.sh2.split(" ").slice(3).join(" ")+")";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.filter="drop-shadow(2px 2px 0 "+th.sh2.split(" ").slice(3).join(" ")+")";}}
            onMouseDown={e=>{e.currentTarget.style.transform="translate(1px,1px)";e.currentTarget.style.filter="drop-shadow(1px 1px 0 "+th.sh2.split(" ").slice(3).join(" ")+")";}}
            onMouseUp={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";}}>
            {isDark?"☀":"◑"}
          </button>
          {isAdmin?(
            <>
              <Btn sm th={th} onClick={()=>setPage(p=>p==="home"?"admin":"home")}>{page==="admin"?tr.vv:tr.ap}</Btn>
              <Btn sm v="danger" th={th} onClick={()=>{setIsAdmin(false);setPage("home");ping("Signed out.");}}>{tr.so}</Btn>
            </>
          ):(
            <Btn sm th={th} onClick={()=>{setModal(hasAdmin?"login":"setup");setPwErr("");setPw("");setPw2("");}}>
              {tr.adm} →
            </Btn>
          )}
        </div>
      </header>

      {/* ── HOME ── */}
      {page==="home"&&(
        <main>
          <section style={{padding:"60px 40px 48px",borderBottom:`1px solid ${th.div}`,background:th.heroBg}}>
            <div style={{maxWidth:980,margin:"0 auto"}}>
              <h1 onClick={handleHeroTitleClick} style={{fontFamily:"'Anton',sans-serif",fontSize:"clamp(44px,7vw,84px)",fontWeight:400,lineHeight:1,letterSpacing:.3,marginBottom:18,cursor:"default",userSelect:"none"}}>
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
                  {[1,2,3,4,5,6,7,8,9,10].map(n=>{
                    const found=foundSecrets.includes(n);
                    return <span key={n} style={{fontSize:15,lineHeight:1,display:"inline-block",color:found?"#c8a84b":th.div,filter:found?"drop-shadow(0 0 6px rgba(200,168,75,.7))":"none",transition:"color .5s, filter .5s",animation:starAnim===n?"starPop .75s cubic-bezier(.22,1,.36,1) both":found?"starGlow 2.5s ease infinite":"none"}}>★</span>;
                  })}
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:th.mut,marginLeft:4,opacity:.6}}>{foundSecrets.length}/10{foundSecrets.length===10?" ✓":""}</span>
                </div>
              )}
            </div>
          </section>

          <div style={{maxWidth:980,margin:"0 auto",padding:"28px 40px 0"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:14}}>
              <div style={{display:"flex",flexWrap:"wrap"}}>
                {CATS.map((c,i)=>{
                  const count=c==="All"?progs.length:progs.filter(p=>p.cat===c).length;
                  return <button key={c} onClick={()=>setCat(c)} style={{padding:"7px 14px",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,border:th.bdr,marginRight:-2,marginBottom:-2,position:"relative",zIndex:cat===c?2:1,background:cat===c?th.blk:th.card,color:cat===c?th.card:th.blk,transition:"background .1s"}}>
                    {tr.cats[i]||c} <span style={{opacity:.4}}>({count})</span>
                  </button>;
                })}
              </div>
              <select value={sort} onChange={e=>setSort(e.target.value)} style={{padding:"7px 12px",border:th.bdr,fontFamily:"'IBM Plex Mono',monospace",fontSize:12,background:th.inputBg,color:th.blk,cursor:"pointer",filter:"drop-shadow(2px 2px 0 "+th.sh2.split(" ").slice(3).join(" ")+")",alignSelf:"flex-start"}}>
                <option value="newest">{tr.sn}</option>
                <option value="popular">{tr.sp}</option>
                <option value="az">{tr.sa}</option>
              </select>
            </div>
            <input style={{...inp,padding:"11px 14px",marginBottom:12}} placeholder={tr.search} value={search} onChange={e=>setSearch(e.target.value)}/>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:28,paddingTop:12,borderTop:`1px solid ${th.div}`}}>
              <span style={{fontSize:11,color:th.mut,marginRight:4,fontFamily:"'IBM Plex Mono',monospace"}}>{tr.platform}</span>
              {OSS.map(o=><button key={o.id} onClick={()=>setOsFilter(f=>f.includes(o.id)?f.filter(x=>x!==o.id):[...f,o.id])} style={{padding:"4px 10px",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,border:th.bdr,background:osFilter.includes(o.id)?th.blk:th.card,color:osFilter.includes(o.id)?th.card:th.blk,transition:"all .1s"}}>{o.l}</button>)}
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
                          <CardWithSecrets p={p} onDownload={download} onLike={handleLike} liked={likes.includes(p.id)} onDetail={setDetailProg} loadingDl={loadingDl} th={th} tr={tr}/>
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
                        <CardWithSecrets p={p} onDownload={download} onLike={handleLike} liked={likes.includes(p.id)} onDetail={setDetailProg} loadingDl={loadingDl} th={th} tr={tr}/>
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

      {/* ── ADMIN ── */}
      {page==="admin"&&isAdmin&&(
        <main style={{maxWidth:800,margin:"0 auto",padding:"48px 40px 80px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:32}}>
            <h1 style={{fontFamily:"'Anton',sans-serif",fontSize:32,fontWeight:400,letterSpacing:.3,color:th.blk}}>{tr.adh}</h1>
            <Btn sm th={th} onClick={()=>{setModal("changepw");setPwErr("");setPw("");setPw2("");}}>{tr.cpb}</Btn>
          </div>

          <div style={{display:"flex",gap:0,marginBottom:36,borderBottom:th.bdr}}>
            {[{id:"programs",label:"Programs"},{id:"site",label:"Site"},{id:"secrets",label:"Secrets ◉"}].map(t=>(
              <button key={t.id} onClick={()=>setAdminTab(t.id)} style={{padding:"12px 22px",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,border:"none",borderBottom:`3px solid ${adminTab===t.id?"#e03d0c":"transparent"}`,background:"none",color:adminTab===t.id?th.blk:th.mut,cursor:"pointer",marginBottom:-2,transition:"color .1s",letterSpacing:.5}}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── PROGRAMS TAB ── */}
          {adminTab==="programs"&&(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:14,marginBottom:40}}>
                {[{l:tr.stp,v:progs.length},{l:tr.std,v:fmt.n(totalDl)},{l:tr.stpin,v:progs.filter(p=>p.featured).length},{l:tr.sttop,v:topProg?.name||"—",sm:true}].map(({l,v,sm})=>(
                  <div key={l} style={{background:th.card,border:th.bdr,padding:"18px 20px",boxShadow:th.sh2}}>
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
                <div style={{marginBottom:18}}><label style={lbl}>{tr.pl}</label><OsToggle val={form.os||[]} onChange={id=>setForm(f=>({...f,os:(f.os||[]).includes(id)?(f.os||[]).filter(x=>x!==id):[...(f.os||[]),id]}))} th={th}/></div>
                <div key={uploadKey} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:18}}>
                  <ImageUploadField label={tr.cov} tip={tr.img_tip} single images={form.coverImage?[form.coverImage]:[]}
                    onChange={async e=>{const f=e.target.files[0];if(!f)return;const img=await processCoverImage(f);if(img)setForm(x=>({...x,coverImage:img}));else ping("Couldn't process image.","err");}}
                    onRemove={()=>setForm(x=>({...x,coverImage:null}))} th={th} lbl={lbl} maxCount={1}/>
                  <ImageUploadField label={tr.scr} tip={tr.img_tip} single={false} images={form.screenshots||[]}
                    onChange={async e=>{const files=Array.from(e.target.files).slice(0,6-(form.screenshots||[]).length);const imgs=await Promise.all(files.map(f=>processScreenshot(f)));setForm(x=>({...x,screenshots:[...(x.screenshots||[]),...imgs.filter(Boolean)].slice(0,6)}));}}
                    onRemove={i=>setForm(x=>({...x,screenshots:x.screenshots.filter((_,j)=>j!==i)}))} th={th} lbl={lbl} maxCount={6}/>
                </div>
                <div style={{marginBottom:22}}>
                  <div style={{display:"flex",marginBottom:12}}>
                    {["url","file"].map((m,i)=>(
                      <button key={m} onClick={()=>setUploadMode(m)} style={{padding:"8px 18px",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,border:th.bdr,marginRight:i===0?-2:0,background:uploadMode===m?th.blk:th.card,color:uploadMode===m?th.card:th.blk,position:"relative",zIndex:uploadMode===m?2:1}}>
                        {m==="url"?tr.lu:tr.uf}
                      </button>
                    ))}
                  </div>
                  {uploadMode==="url"?(
                    <div><label style={lbl}>{tr.ul}</label><input style={inp} value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://..."/></div>
                  ):(
                    <div>
                      <label style={lbl}>{tr.fl}</label>
                      <input ref={fileRef} type="file" style={{...inp,padding:"8px 12px"}} onChange={e=>setForm({...form,file:e.target.files[0]})}/>
                      <p style={{fontSize:10,color:th.mut,marginTop:6,fontFamily:"'IBM Plex Mono',monospace"}}>{tr.bf}</p>
                    </div>
                  )}
                </div>
                <Btn v="primary" onClick={upload} disabled={busy} th={th} style={{padding:"11px 32px"}}>{busy?tr.adng:tr.ab}</Btn>
              </div>

              {progs.length>0&&(
                <div>
                  <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:20,fontWeight:400,marginBottom:16,letterSpacing:.3,color:th.blk}}>{tr.mgmt} ({progs.length})</h2>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {[...progs].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(p=>(
                      <div key={p.id} style={{background:th.card,border:th.bdr,padding:"15px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,boxShadow:th.sh2}}>
                        <div style={{flex:1,minWidth:0,display:"flex",gap:14,alignItems:"center"}}>
                          {p.coverImage&&<div style={{width:46,height:46,flexShrink:0,border:th.bdr,overflow:"hidden"}}><img src={p.coverImage} style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}
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
                          <div style={{display:"flex",gap:6,flexShrink:0}}>
                            <Btn sm v="danger" th={th} onClick={()=>remove(p.id)}>{tr.yd}</Btn>
                            <Btn sm th={th} onClick={()=>setDelId(null)}>{tr.cncl}</Btn>
                          </div>
                        ):(
                          <div style={{display:"flex",gap:6,flexShrink:0}}>
                            <button title={p.featured?tr.upin:tr.pin} onClick={()=>toggleFeatured(p.id)} style={{padding:"5px 10px",border:th.bdr,background:p.featured?"#e03d0c":th.card,color:p.featured?th.card:th.blk,cursor:"pointer",fontSize:13,filter:"drop-shadow(2px 2px 0 "+th.sh2.split(" ").slice(3).join(" ")+")",transition:"filter .1s, transform .1s"}}
                              onMouseEnter={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";}}
                              onMouseLeave={e=>{e.currentTarget.style.transform="none";}}
                              onMouseDown={e=>{e.currentTarget.style.transform="translate(1px,1px)";}}
                              onMouseUp={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";}}>★</button>
                            <Btn sm th={th} onClick={()=>{setEditId(p.id);setEditForm({name:p.name,desc:p.desc||"",ver:p.ver||"1.0",cat:p.cat||"Tools",url:p.url||"",os:p.os||[],coverImage:p.coverImage||null,screenshots:p.screenshots||[]});setModal("edit");}}>{tr.ed}</Btn>
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

          {/* ── SITE TAB ── */}
          {adminTab==="site"&&(
            <div style={{display:"flex",flexDirection:"column",gap:24}}>
              <div style={{background:th.card,border:th.bdr,padding:32,boxShadow:th.sh2}}>
                <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:20,fontWeight:400,marginBottom:20,letterSpacing:.3,color:th.blk}}>{tr.ss}</h2>
                <label style={lbl}>{tr.hsl}</label>
                <textarea style={{...inp,height:80,resize:"vertical",marginBottom:16}} value={heroSubDraft} onChange={e=>setHeroSubDraft(e.target.value)} placeholder={tr.sub}/>
                <Btn sm v="primary" th={th} onClick={saveHeroSub}>{tr.ans}</Btn>
              </div>
              <div style={{background:th.card,border:th.bdr,padding:32,boxShadow:th.sh2}}>
                <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:20,fontWeight:400,marginBottom:20,letterSpacing:.3,color:th.blk}}>{tr.anh}</h2>
                {ann.visible&&ann.text&&<div style={{padding:"10px 14px",marginBottom:16,background:annC.bg,border:`1px solid ${annC.b}`,fontSize:12,color:annC.t,fontFamily:"'IBM Plex Mono',monospace",lineHeight:1.6}}>✓ {tr.anl}: "{ann.text.slice(0,60)}{ann.text.length>60?"...":""}"</div>}
                <textarea style={{...inp,height:72,resize:"vertical",marginBottom:16}} value={annDraft.text} onChange={e=>setAnnDraft(a=>({...a,text:e.target.value}))} placeholder={tr.anph}/>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{fontSize:11,color:th.mut,fontFamily:"'IBM Plex Mono',monospace"}}>{tr.ant}:</span>
                  {["info","warning","update"].map(t=>(
                    <button key={t} onClick={()=>setAnnDraft(a=>({...a,type:t}))} style={{padding:"5px 12px",cursor:"pointer",border:th.bdr,fontSize:11,fontFamily:"'IBM Plex Mono',monospace",background:annDraft.type===t?th.blk:th.card,color:annDraft.type===t?th.card:th.blk}}>
                      {t==="info"?tr.ani:t==="warning"?tr.anw:tr.anu}
                    </button>
                  ))}
                  <Btn sm v="primary" th={th} onClick={saveAnn}>{tr.ans}</Btn>
                  {ann.visible&&<Btn sm v="danger" th={th} onClick={clearAnn}>{tr.anc}</Btn>}
                </div>
              </div>
              <div style={{background:th.card,border:th.bdr,padding:32,boxShadow:th.sh2}}>
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

          {/* ── SECRETS TAB ── */}
          {adminTab==="secrets"&&(
            <div>
              <div style={{background:th.card,border:th.bdr,padding:28,boxShadow:th.sh2,marginBottom:28}}>
                <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:20,fontWeight:400,letterSpacing:.3,color:th.blk,marginBottom:10}}>Secret Downloads</h2>
                <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:th.mut,lineHeight:1.85,marginBottom:20}}>Each secret can optionally reveal a hidden download when triggered. The "How to trigger" box below each one explains exactly how it fires.</p>
                <div style={{display:"flex",alignItems:"center",gap:5,paddingTop:16,borderTop:`1px solid ${th.div}`,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:th.mut,marginRight:4}}>found on this device:</span>
                  {[1,2,3,4,5,6,7,8,9,10].map(n=>{
                    const found=foundSecrets.includes(n);
                    return <span key={n} style={{fontSize:15,color:found?"#c8a84b":th.div,filter:found?"drop-shadow(0 0 5px rgba(200,168,75,.7))":"none",transition:"all .3s"}}>★</span>;
                  })}
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:th.mut}}>{foundSecrets.length}/10</span>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {SECRET_LABELS.map((sl,idx)=>{
                  const dl=sdDraft[idx]||{...BLANK_DL};
                  const isLive=sett.secretDownloads?.[idx]?.enabled&&sett.secretDownloads?.[idx]?.name;
                  const found=foundSecrets.includes(idx+1);
                  return(
                    <div key={idx} style={{background:th.card,border:th.bdr,padding:24,boxShadow:th.sh2}}>
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

      {/* Footer */}
      <footer style={{borderTop:`1px solid ${th.div}`,padding:"16px 40px",display:"flex",justifyContent:"space-between",alignItems:"center",background:th.heroBg}}>
        <span onMouseEnter={handleFooterVaultEnter} onMouseLeave={handleFooterVaultLeave} style={{fontFamily:"'Anton',sans-serif",fontSize:14,letterSpacing:.3,color:th.blk,cursor:"default",userSelect:"none"}}>SoftwareVault</span>
        <span onClick={handleFooterYearClick} style={{fontSize:11,color:th.mut,fontFamily:"'IBM Plex Mono',monospace",cursor:"default",userSelect:"none"}}>{new Date().getFullYear()}</span>
      </footer>

      {detailProg&&<DetailModal prog={detailProg} liked={likes.includes(detailProg.id)} onLike={handleLike} onDownload={download} loadingDl={loadingDl} onClose={()=>setDetailProg(null)} th={th} tr={tr}/>}

      {/* ── Auth / Edit Modals ── */}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:20}} onClick={()=>setModal(null)}>
          {(modal==="login"||modal==="setup"||modal==="changepw")&&(
            <div onClick={e=>e.stopPropagation()} style={{background:th.card,border:th.bdr,padding:32,width:"100%",maxWidth:360,boxShadow:`8px 8px 0 ${th.blk}`,animation:"modalIn .2s cubic-bezier(.22,1,.36,1) both"}}>
              <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:22,fontWeight:400,marginBottom:modal==="setup"?10:20,letterSpacing:.3,color:th.blk}}>{modal==="login"?tr.si:modal==="setup"?tr.sat:tr.cp}</h2>
              {modal==="setup"&&<p style={{fontSize:12,color:th.mut,lineHeight:1.8,marginBottom:18,fontFamily:"'IBM Plex Mono',monospace"}}>{tr.ot}</p>}
              <label style={lbl}>{modal==="login"?tr.pw:modal==="changepw"?tr.pwn:tr.pwm}</label>
              <input type="password" style={{...inp,marginBottom:12}} value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){modal==="login"?login():modal==="changepw"?changePw():setupAdmin();}}} placeholder="••••••••" autoFocus/>
              {(modal==="setup"||modal==="changepw")&&(<>
                <label style={lbl}>{tr.conf}</label>
                <input type="password" style={{...inp,marginBottom:12}} value={pw2} onChange={e=>setPw2(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){modal==="changepw"?changePw():setupAdmin();}}} placeholder="••••••••"/>
              </>)}
              {pwErr&&<p style={{fontSize:12,color:"#e03d0c",marginBottom:12,fontFamily:"'IBM Plex Mono',monospace"}}>{pwErr}</p>}
              {modal==="setup"&&<p style={{fontSize:10,color:th.mut,marginBottom:16,lineHeight:1.75,padding:"8px 12px",background:th.bg,border:`1px solid ${th.div}`,fontFamily:"'IBM Plex Mono',monospace"}}>{tr.lw}</p>}
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <Btn sm th={th} onClick={()=>setModal(null)}>{tr.cncl}</Btn>
                <Btn sm v="primary" th={th} onClick={modal==="login"?login:modal==="changepw"?changePw:setupAdmin}>{modal==="login"?tr.si:modal==="changepw"?tr.sv:tr.ca}</Btn>
              </div>
            </div>
          )}
          {modal==="edit"&&editId&&(
            <div onClick={e=>e.stopPropagation()} style={{background:th.card,border:th.bdr,padding:32,width:"100%",maxWidth:560,boxShadow:`8px 8px 0 ${th.blk}`,animation:"modalIn .2s cubic-bezier(.22,1,.36,1) both",maxHeight:"90vh",overflowY:"auto"}}>
              <h2 style={{fontFamily:"'Anton',sans-serif",fontSize:22,fontWeight:400,marginBottom:20,letterSpacing:.3,color:th.blk}}>{tr.edh}</h2>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                <div><label style={lbl}>{tr.nl.replace(" *","")}</label><input style={inp} value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})}/></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><label style={lbl}>{tr.vl}</label><input style={inp} value={editForm.ver} onChange={e=>setEditForm({...editForm,ver:e.target.value})}/></div>
                  <div><label style={lbl}>{tr.cl}</label><select style={{...inp,cursor:"pointer"}} value={editForm.cat} onChange={e=>setEditForm({...editForm,cat:e.target.value})}>{CATS.filter(c=>c!=="All").map((c,i)=><option key={c} value={c}>{tr.cats[i+1]||c}</option>)}</select></div>
                </div>
              </div>
              <div style={{marginBottom:14}}><label style={lbl}>{tr.dl2}</label><textarea style={{...inp,height:72,resize:"vertical"}} value={editForm.desc} onChange={e=>setEditForm({...editForm,desc:e.target.value})}/></div>
              <div style={{marginBottom:14}}><label style={lbl}>{tr.kf}</label><input style={inp} value={editForm.url} onChange={e=>setEditForm({...editForm,url:e.target.value})} placeholder="https://..."/></div>
              <div style={{marginBottom:14}}><label style={lbl}>{tr.pl}</label><OsToggle val={editForm.os||[]} onChange={id=>setEditForm(f=>({...f,os:(f.os||[]).includes(id)?(f.os||[]).filter(x=>x!==id):[...(f.os||[]),id]}))} th={th}/></div>
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
                <Btn sm v="primary" th={th} onClick={saveEdit}>{tr.sc}</Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          SECRET OVERLAYS
      ════════════════════════════════════════ */}

      {/* SECRET 1 — Konami: CRT terminal */}
      {secret1&&(
        <div onClick={()=>setSecret1(false)} style={{position:"fixed",inset:0,background:"#030b03",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,cursor:"pointer",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(0deg,rgba(0,0,0,.15) 0px,rgba(0,0,0,.15) 1px,transparent 1px,transparent 3px)",pointerEvents:"none"}}/>
          <div style={{position:"absolute",left:0,right:0,height:80,background:"linear-gradient(transparent,rgba(0,255,65,.05),transparent)",animation:"crtScan 3.5s linear infinite",pointerEvents:"none"}}/>
          <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:"#020c02",border:"2px solid #00cc33",padding:"36px 44px",maxWidth:540,width:"100%",boxShadow:"0 0 0 1px #001a00,0 0 60px rgba(0,255,65,.2)",animation:"modalIn .3s cubic-bezier(.22,1,.36,1),terminalGlow 4s ease infinite"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#00cc33",opacity:.5,letterSpacing:3}}>↑↑↓↓←→←→</span>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#00cc33",opacity:.3,letterSpacing:2}}>SECRET 01/10</span>
            </div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#00e836",lineHeight:2.1,minHeight:200,marginBottom:16}}>
              {termLines.map((l,i)=>(
                <div key={i}>{l||<span style={{opacity:.15}}>·</span>}{i===termLines.length-1&&<span style={{marginLeft:2,animation:"blink .9s step-end infinite",color:"#00ff41"}}>█</span>}</div>
              ))}
            </div>
            <SecretDownloadCard dl={getSd(1)} accentColor="#00cc33" textColor="#00e836" bgColor="rgba(0,255,65,.04)" borderColor="rgba(0,255,65,.15)"/>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#00cc33",opacity:.25,letterSpacing:1}}>click to close channel</div>
          </div>
        </div>
      )}

      {/* SECRET 2 — Logo 5×: glitch */}
      {secret2&&(
        <div style={{position:"fixed",inset:0,background:"#050505",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"fadeIn .15s ease"}} onClick={()=>setSecret2(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#0a0a0a",border:"2px solid #e8e4d8",padding:"48px 44px",maxWidth:460,width:"100%",boxShadow:"8px 8px 0 #e03d0c",animation:"modalIn .22s cubic-bezier(.22,1,.36,1)"}}>
            <div style={{position:"relative",marginBottom:10,height:80}}>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:68,fontWeight:400,color:"#e8e4d8",lineHeight:1,letterSpacing:.5,position:"absolute",top:0,left:0,zIndex:3}}>HEY YOU.</div>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:68,fontWeight:400,color:"#e03d0c",lineHeight:1,letterSpacing:.5,position:"absolute",top:0,left:0,zIndex:2,animation:"glitch1 2.4s steps(1) infinite",mixBlendMode:"screen"}}>HEY YOU.</div>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:68,fontWeight:400,color:"#0ff",lineHeight:1,letterSpacing:.5,position:"absolute",top:0,left:0,zIndex:1,animation:"glitch2 3.1s steps(1) infinite",mixBlendMode:"screen",opacity:.6}}>HEY YOU.</div>
            </div>
            <div style={{fontSize:9,color:"#444",marginBottom:20,fontFamily:"'IBM Plex Mono',monospace",letterSpacing:3}}>SECRET 02/10 — LOGO SEQUENCE</div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:"#666",lineHeight:1.9,marginBottom:20}}>five clicks on the logo.<br/>nobody does that on accident.<br/><br/>i see you poking around.<br/>keep going.</p>
            <SecretDownloadCard dl={getSd(2)} accentColor="#e03d0c" textColor="#e8e4d8" bgColor="rgba(255,255,255,.03)" borderColor="rgba(255,255,255,.08)"/>
            <button onClick={()=>setSecret2(false)} style={{padding:"9px 22px",border:"2px solid #e8e4d8",background:"#e8e4d8",color:"#0a0a0a",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:2,filter:"drop-shadow(3px 3px 0 #e03d0c)",transition:"filter .1s, transform .1s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";e.currentTarget.style.filter="drop-shadow(4px 4px 0 #e03d0c)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.filter="drop-shadow(3px 3px 0 #e03d0c)";}}
              onMouseDown={e=>{e.currentTarget.style.transform="translate(1px,1px)";e.currentTarget.style.filter="drop-shadow(1px 1px 0 #e03d0c)";}}
              onMouseUp={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";e.currentTarget.style.filter="drop-shadow(4px 4px 0 #e03d0c)";}}>CLOSE</button>
          </div>
        </div>
      )}

      {/* SECRET 3 — Triple-click title: radar signal */}
      {secret3&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"fadeIn .2s ease"}} onClick={()=>setSecret3(false)}>
          {[0,.5,1].map(d=><div key={d} style={{position:"absolute",borderRadius:"50%",width:240,height:240,border:"1px solid rgba(255,140,0,.4)",pointerEvents:"none",animation:`radarPing 2.4s ease-out ${d}s infinite`}}/>)}
          <div onClick={e=>e.stopPropagation()} style={{position:"relative",zIndex:10,background:"#0d0a06",border:"2px solid #ff8c00",padding:"40px 44px",maxWidth:460,width:"100%",boxShadow:"0 0 80px rgba(255,140,0,.15),8px 8px 0 #e03d0c",animation:"modalIn .28s cubic-bezier(.22,1,.36,1)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#ff8c00",letterSpacing:2,animation:"scanPulse 1.6s ease infinite"}}>◉ SIGNAL DETECTED</span>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#ff8c00",opacity:.4,letterSpacing:2}}>SECRET 03/10</span>
            </div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:56,fontWeight:400,color:"#ff8c00",lineHeight:1,marginBottom:20,letterSpacing:.5,animation:"vaultReveal .5s ease both"}}>FOUND<br/>ONE.</div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#7a6a55",lineHeight:1.9,marginBottom:18}}>triple-clicking the title wasn't<br/>in any instructions.<br/><br/>there are no instructions.<br/>you invented that yourself.</p>
            <SecretDownloadCard dl={getSd(3)} accentColor="#ff8c00" textColor="#e8d0aa" bgColor="rgba(255,140,0,.04)" borderColor="rgba(255,140,0,.18)"/>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#4a3a25",letterSpacing:1}}>SIG/NOISE: 47.3dB · {new Date().toISOString().slice(0,19).replace("T"," ")}Z</div>
          </div>
        </div>
      )}

      {/* SECRET 4 — Type "open": vault door */}
      {secret4&&(
        <div onClick={()=>setSecret4(false)} style={{position:"fixed",inset:0,background:"rgba(8,6,3,.95)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"fadeIn .25s ease",cursor:"pointer"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#111008",border:"3px solid #7a6a44",padding:"40px 44px",maxWidth:500,width:"100%",boxShadow:"0 0 0 6px #1a1508,0 0 80px rgba(200,168,75,.12),10px 10px 0 #000",animation:"modalIn .4s cubic-bezier(.22,1,.36,1)",position:"relative",cursor:"default"}}>
            <div style={{position:"absolute",top:18,right:18,width:52,height:52,borderRadius:"50%",border:"3px solid #4a3a22",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:18,height:18,borderRadius:"50%",background:"radial-gradient(circle,#3a2a14,#1a1008)",border:"2px solid #4a3a22"}}/>
            </div>
            <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#c8a84b",opacity:.6,letterSpacing:2}}>☐ VAULT UNLOCKED — SECRET 04/10</span>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:60,fontWeight:400,lineHeight:1,letterSpacing:.5,margin:"18px 0",animation:"vaultGlow 2.5s ease infinite"}}><span style={{color:"#c8a84b"}}>OPEN.</span></div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#6a5a3a",lineHeight:1.9,marginBottom:18}}>you typed the word.<br/>most people never think to try.</p>
            <SecretDownloadCard dl={getSd(4)} accentColor="#c8a84b" textColor="#e8e0cc" bgColor="rgba(200,168,75,.04)" borderColor="rgba(200,168,75,.2)"/>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#3a2a12",letterSpacing:1}}>click anywhere to seal vault</div>
          </div>
        </div>
      )}

      {/* SECRET 5 — Stats 5×: classified dossier */}
      {secret5&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"fadeIn .2s ease"}} onClick={()=>setSecret5(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fdf9f0",border:"1px solid #c8b888",padding:"44px 44px 36px",maxWidth:480,width:"100%",position:"relative",overflow:"hidden",boxShadow:"10px 10px 0 #111",animation:"modalIn .25s cubic-bezier(.22,1,.36,1)"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:6,background:"#b40000"}}/>
            <div style={{position:"absolute",top:36,right:28,fontFamily:"'Anton',sans-serif",fontSize:24,color:"rgba(180,0,0,.75)",border:"4px solid rgba(180,0,0,.65)",padding:"5px 12px",transform:"rotate(-12deg)",letterSpacing:3,animation:"stampDrop .45s cubic-bezier(.22,1,.36,1) .15s both"}}>CLASSIFIED</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#888",marginBottom:16,letterSpacing:2}}>VAULT INTERNAL · EYES ONLY · SECRET 05/10</div>
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
            <SecretDownloadCard dl={getSd(5)} accentColor="#b40000" textColor="#1a1008" bgColor="rgba(180,0,0,.04)" borderColor="rgba(180,0,0,.15)"/>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#aaa"}}>DO NOT DISTRIBUTE · click to seal</div>
          </div>
        </div>
      )}

      {/* SECRET 6 — Footer hover: ghost */}
      {secret6&&(
        <div style={{position:"fixed",bottom:64,left:"50%",zIndex:9000,animation:"ghostFadeIn .5s ease both, ghostFloat 3s ease .5s infinite",cursor:"pointer"}} onClick={()=>setSecret6(false)}>
          <div style={{background:"rgba(10,10,10,.97)",border:"1px solid #2a2a2a",padding:"20px 28px",minWidth:260,boxShadow:"0 -8px 40px rgba(0,0,0,.7)"}}>
            <div style={{fontSize:9,color:"#444",marginBottom:10,letterSpacing:2}}>SECRET 06/10 · FOOTER</div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:24,color:"#e8e4d8",marginBottom:10,letterSpacing:.3}}>still here?</div>
            <p style={{fontSize:11,color:"#555",lineHeight:1.85,marginBottom:getSd(6)?.enabled&&getSd(6)?.name?14:0}}>you hovered "vault" for three<br/>whole seconds. i noticed.<br/>i always notice.</p>
            <SecretDownloadCard dl={getSd(6)} accentColor="#888" textColor="#ccc" bgColor="rgba(255,255,255,.03)" borderColor="rgba(255,255,255,.07)"/>
            <div style={{fontSize:9,color:"#333",letterSpacing:1}}>click to dismiss</div>
          </div>
          <div style={{position:"absolute",bottom:-8,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"8px solid transparent",borderRight:"8px solid transparent",borderTop:"8px solid #2a2a2a"}}/>
        </div>
      )}

      {/* SECRET 7 — UNDERTALE: right-click card → Check screen */}
      {secret7&&(
        <div style={{position:"fixed",inset:0,background:"#000",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"fadeIn .08s ease"}} onClick={()=>setSecret7(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#000",border:"2px solid #fff",padding:"48px 44px",maxWidth:520,width:"100%",animation:"modalIn .15s cubic-bezier(.22,1,.36,1)",textAlign:"center",fontFamily:"'Courier New',monospace"}}>
            <div style={{fontSize:9,color:"#555",marginBottom:24,letterSpacing:3}}>SECRET 07/10 — UNDERTALE</div>
            {/* Battle box */}
            <div style={{border:"3px solid #fff",width:80,height:80,margin:"0 auto 28px",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontSize:24,color:"#ff3333",lineHeight:1,animation:"mercyFlicker .5s ease infinite"}}>♥</div>
            </div>
            <div style={{fontSize:18,color:"#fff",marginBottom:8,lineHeight:1.7,fontWeight:"bold"}}>
              * {s7CardName||"???"}
            </div>
            <div style={{fontSize:13,color:"#aaa",lineHeight:2.1,marginBottom:8}}>
              ATK 0 &nbsp; DEF 0
            </div>
            <div style={{fontSize:13,color:"#aaa",lineHeight:2.1,marginBottom:24}}>
              * you right-clicked to check.<br/>
              * it's free software.<br/>
              * it just wants to be used.
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:36,marginBottom:28,fontSize:15}}>
              {["FIGHT","ACT","ITEM","MERCY"].map((opt,i)=>(
                <span key={opt} style={{color:i===3?"#ffff00":"#fff",cursor:"pointer",letterSpacing:1,fontWeight:i===3?"bold":"normal",textShadow:i===3?"0 0 10px #ffff00":"none"}} onClick={()=>setSecret7(false)}>{opt}</span>
              ))}
            </div>
            <SecretDownloadCard dl={getSd(7)} accentColor="#ff3333" textColor="#fff" bgColor="rgba(255,255,255,.04)" borderColor="rgba(255,255,255,.15)"/>
            <div style={{fontSize:10,color:"#444",letterSpacing:1}}>click anywhere to continue</div>
          </div>
        </div>
      )}

      {/* SECRET 8 — DELTARUNE: scroll rush → darkworld */}
      {secret8&&(
        <div style={{position:"fixed",inset:0,zIndex:9000,cursor:"pointer",overflow:"hidden",
          background:"#0a001a"}} onClick={()=>setSecret8(false)}>
          {/* Animated aurora background */}
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 120% 80% at 50% 120%,#2a006a 0%,#0a001a 60%)",opacity:.9}}/>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 40% at 30% 60%,#4a0080 0%,transparent 70%)",animation:"scanPulse 4s ease infinite"}}/>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 50% 35% at 70% 40%,#001a4a 0%,transparent 70%)",animation:"scanPulse 5s ease infinite 1s"}}/>
          {/* Stars */}
          {Array.from({length:40}).map((_,i)=>(
            <div key={i} style={{position:"absolute",
              width:i%8===0?3:i%4===0?2:1,height:i%8===0?3:i%4===0?2:1,
              background:`rgba(255,255,255,${0.2+((i*0.07)%0.6)})`,borderRadius:"50%",
              left:`${(i*41+13)%100}%`,top:`${(i*31+7)%100}%`,
              animation:`blink ${1+(i%5)*.5}s ease infinite ${(i%7)*.3}s`}}/>
          ))}
          {/* Floating particle motes */}
          {Array.from({length:8}).map((_,i)=>(
            <div key={`m${i}`} style={{position:"absolute",
              width:4,height:4,borderRadius:"50%",
              background:"rgba(180,120,255,.6)",
              left:`${15+i*10}%`,
              bottom:`${10+i*5}%`,
              animation:`ghostFloat ${3+i*.4}s ease infinite ${i*.5}s`,
              filter:"blur(1px)"}}/>
          ))}

          <div onClick={e=>e.stopPropagation()} style={{
            position:"relative",zIndex:2,
            display:"flex",alignItems:"center",justifyContent:"center",
            minHeight:"100vh",padding:20}}>
            <div style={{
              background:"linear-gradient(160deg,rgba(20,0,50,.97) 0%,rgba(8,0,28,.99) 100%)",
              border:"1px solid rgba(120,70,220,.5)",
              padding:"48px 44px",maxWidth:520,width:"100%",
              boxShadow:"0 0 0 1px rgba(100,50,200,.2),0 0 60px rgba(100,50,200,.25),0 0 120px rgba(80,30,160,.15)",
              animation:"scrollRushIn .45s cubic-bezier(.22,1,.36,1)",cursor:"default",
              position:"relative",overflow:"hidden"}}>

              {/* Subtle inner glow top */}
              <div style={{position:"absolute",top:0,left:"10%",right:"10%",height:1,
                background:"linear-gradient(90deg,transparent,rgba(160,100,255,.6),transparent)"}}/>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28}}>
                <div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,
                    color:"rgba(160,100,255,.7)",letterSpacing:3,marginBottom:4}}>✦ CHAPTER SELECT</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,
                    color:"rgba(100,60,180,.6)",letterSpacing:2}}>DARK WORLD · ENCRYPTED</div>
                </div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,
                  color:"rgba(80,40,140,.6)",letterSpacing:2}}>SECRET 08/10</div>
              </div>

              {/* Ralsei — more detailed SVG */}
              <div style={{display:"flex",justifyContent:"center",marginBottom:24}}>
                <svg width="72" height="96" viewBox="0 0 72 96" fill="none">
                  {/* Cape / body */}
                  <ellipse cx="36" cy="78" rx="22" ry="16" fill="#1a3a1a" opacity=".9"/>
                  {/* Head */}
                  <ellipse cx="36" cy="56" rx="16" ry="15" fill="#e8e0cc"/>
                  {/* Eyes */}
                  <ellipse cx="30" cy="55" rx="3" ry="3.5" fill="#2a1a00"/>
                  <ellipse cx="42" cy="55" rx="3" ry="3.5" fill="#2a1a00"/>
                  <ellipse cx="31" cy="54" rx="1" ry="1.2" fill="#fff" opacity=".7"/>
                  <ellipse cx="43" cy="54" rx="1" ry="1.2" fill="#fff" opacity=".7"/>
                  {/* Smile */}
                  <path d="M30 62 Q36 66 42 62" stroke="#2a1a00" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                  {/* Hat brim */}
                  <rect x="18" y="40" width="36" height="6" rx="2" fill="#1a5a1a"/>
                  {/* Hat cone */}
                  <path d="M26 40 L36 4 L46 40Z" fill="#1a6b1a"/>
                  {/* Hat highlight */}
                  <path d="M34 8 L36 4 L38 8" fill="rgba(255,255,255,.15)"/>
                  {/* White band */}
                  <rect x="19" y="38" width="34" height="5" rx="1.5" fill="#f0ece0"/>
                  {/* Star on hat */}
                  <circle cx="36" cy="16" r="3" fill="rgba(200,160,255,.9)"/>
                  <circle cx="36" cy="16" r="1.5" fill="#fff" opacity=".8"/>
                  {/* Scarf */}
                  <path d="M22 68 Q36 72 50 68" stroke="#cc2222" strokeWidth="4" fill="none" strokeLinecap="round"/>
                  {/* Hands */}
                  <ellipse cx="18" cy="74" rx="5" ry="4" fill="#e8e0cc"/>
                  <ellipse cx="54" cy="74" rx="5" ry="4" fill="#e8e0cc"/>
                  {/* Glow from star */}
                  <circle cx="36" cy="16" r="8" fill="rgba(180,120,255,.12)"/>
                </svg>
              </div>

              <div style={{textAlign:"center",marginBottom:6}}>
                <div style={{fontFamily:"'Anton',sans-serif",fontSize:38,fontWeight:400,
                  color:"#c8a0ff",letterSpacing:1,lineHeight:1,
                  textShadow:"0 0 20px rgba(180,120,255,.4),0 0 40px rgba(140,80,220,.2)"}}>
                  RALSEI
                </div>
              </div>
              <div style={{textAlign:"center",marginBottom:22}}>
                <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,
                  color:"rgba(120,80,200,.6)",letterSpacing:3}}>PRINCE FROM THE DARK</span>
              </div>

              <div style={{height:1,background:"linear-gradient(90deg,transparent,rgba(120,70,220,.35),transparent)",marginBottom:20}}/>

              <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,
                color:"rgba(180,140,240,.7)",lineHeight:2,marginBottom:20,textAlign:"center"}}>
                you scrolled all the way down.<br/>
                three times.<br/><br/>
                <span style={{color:"rgba(200,170,255,.9)"}}>"you were looking for something.<br/>
                i hope you found it."</span>
              </p>

              <SecretDownloadCard dl={getSd(8)} accentColor="#9966ff" textColor="#ddbbff"
                bgColor="rgba(100,50,200,.06)" borderColor="rgba(120,70,220,.25)"/>

              <div style={{textAlign:"center",fontFamily:"'IBM Plex Mono',monospace",
                fontSize:9,color:"rgba(80,40,140,.5)",letterSpacing:2}}>
                click to return from the dark world
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECRET 9 — ULTRAKILL: hold download 2s → machine */}
      {secret9&&(
        <div style={{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"fadeIn .04s ease",cursor:"pointer",background:"#0d0000"}} onClick={()=>setSecret9(false)}>
          {Array.from({length:10}).map((_,i)=>(
            <div key={i} style={{position:"absolute",top:0,left:`${i*10+5}%`,width:2+(i%3),background:"linear-gradient(#aa0000,#660000)",animation:`bloodDrip .${6+i}s ease ${i*.08}s both`,height:`${15+i*5}%`,borderRadius:"0 0 2px 2px"}}/>
          ))}
          <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:"#0d0000",border:"3px solid #cc0000",padding:"44px",maxWidth:520,width:"100%",boxShadow:"0 0 0 1px #330000,0 0 100px rgba(204,0,0,.35),10px 10px 0 #000",animation:"modalIn .1s cubic-bezier(.22,1,.36,1)",cursor:"default"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#cc0000",letterSpacing:2,animation:"scanPulse .4s ease infinite"}}>▮ MACHINE ACTIVE</span>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#660000",letterSpacing:2}}>SECRET 09/10</span>
            </div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#660000",letterSpacing:6,marginBottom:8}}>MANKIND IS DEAD</div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:58,fontWeight:400,color:"#ff1100",lineHeight:.95,letterSpacing:.5,marginBottom:6,textShadow:"0 0 30px rgba(255,17,0,.4)"}}>BLOOD IS<br/>FUEL.</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#880000",lineHeight:1.6,marginBottom:4,letterSpacing:3}}>HELL IS FULL.</div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#cc3333",lineHeight:1.9,marginBottom:20}}>
              you held the download button.<br/>
              you didn't click. you charged.<br/><br/>
              <span style={{color:"#ff1100",letterSpacing:2}}>ULTRAKILL.</span>
            </p>
            <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"center"}}>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#660000",letterSpacing:1}}>RANK</span>
              {["P","S","A","B","C","D"].map((rank,i)=>(
                <div key={rank} style={{width:30,height:30,border:`2px solid ${i===0?"#ffee00":"#3a0000"}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Anton',sans-serif",fontSize:16,color:i===0?"#ffee00":"#3a0000",boxShadow:i===0?"0 0 14px rgba(255,238,0,.6)":"none",background:i===0?"rgba(255,238,0,.05)":"none"}}>
                  {rank}
                </div>
              ))}
            </div>
            <SecretDownloadCard dl={getSd(9)} accentColor="#cc0000" textColor="#ffaaaa" bgColor="rgba(204,0,0,.05)" borderColor="rgba(204,0,0,.2)"/>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#440000",letterSpacing:1}}>click to stop the machine</div>
          </div>
        </div>
      )}

      {/* SECRET 10 — Theme spammer: screen breakdown */}
      {secret10&&(
        <div style={{position:"fixed",inset:0,background:isDark?"#141414":"#f0ece0",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20,animation:"themeFlash .4s ease both"}} onClick={()=>setSecret10(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:th.card,border:th.bdr,padding:"44px 44px",maxWidth:480,width:"100%",boxShadow:`8px 8px 0 ${th.blk}`,animation:"themeGlitch .3s ease both, modalIn .25s cubic-bezier(.22,1,.36,1)"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:th.mut,marginBottom:20,letterSpacing:3}}>SECRET 10/10 — SYSTEM ERROR</div>
            <div style={{position:"relative",marginBottom:16}}>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:52,fontWeight:400,color:th.blk,lineHeight:1,letterSpacing:.5}}>YOU<br/>BROKE IT.</div>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:52,fontWeight:400,color:"#e03d0c",lineHeight:1,letterSpacing:.5,position:"absolute",top:0,left:0,animation:"glitch1 1.8s steps(1) infinite",mixBlendMode:"multiply",opacity:.7}}>YOU<br/>BROKE IT.</div>
            </div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:th.mut,letterSpacing:2,marginBottom:16}}>
              ERR_THEME_OVERFLOW · 10 toggles / 3s
            </div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:th.mut,lineHeight:1.9,marginBottom:20}}>
              light. dark. light. dark. light.<br/>
              dark. light. dark. light. dark.<br/><br/>
              the vault doesn't know what it is anymore.<br/>
              neither do you, probably.
            </p>
            <SecretDownloadCard dl={getSd(10)} accentColor={th.org} textColor={th.blk} bgColor={th.bg} borderColor={th.div}/>
            <button onClick={()=>setSecret10(false)} style={{padding:"9px 22px",border:th.bdr,background:th.blk,color:th.card,cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:2,filter:`drop-shadow(3px 3px 0 ${th.sh2.split(" ").slice(3).join(" ")})`,transition:"filter .1s, transform .1s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";}}
              onMouseDown={e=>{e.currentTarget.style.transform="translate(1px,1px)";}}
              onMouseUp={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";}}>REBOOT</button>
          </div>
        </div>
      )}

      {/* ALL 10 FOUND */}
      {allFoundModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9500,padding:20,animation:"fadeIn .3s ease"}} onClick={()=>setAllFoundModal(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#0e0b04",border:"2px solid #c8a84b",padding:"52px 48px",maxWidth:520,width:"100%",textAlign:"center",position:"relative",overflow:"hidden",boxShadow:"0 0 0 6px #1a1408,0 0 120px rgba(200,168,75,.25),14px 14px 0 #000",animation:"allFoundIn .5s cubic-bezier(.22,1,.36,1) both"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,transparent,#c8a84b,#fff8dc,#c8a84b,transparent)",backgroundSize:"200% 100%",animation:"goldShimmer 2s linear infinite"}}/>
            <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:"linear-gradient(90deg,transparent,#c8a84b,#fff8dc,#c8a84b,transparent)",backgroundSize:"200% 100%",animation:"goldShimmer 2s linear infinite reverse"}}/>
            <div style={{display:"flex",gap:7,justifyContent:"center",marginBottom:28,flexWrap:"wrap"}}>
              {[0,1,2,3,4,5,6,7,8,9].map(i=>(
                <span key={i} style={{fontSize:26,color:"#c8a84b",display:"inline-block",filter:"drop-shadow(0 0 10px rgba(200,168,75,.9))",animation:`starPop .7s cubic-bezier(.22,1,.36,1) ${i*0.07}s both`}}>★</span>
              ))}
            </div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:52,fontWeight:400,letterSpacing:.5,lineHeight:1,marginBottom:8,animation:"vaultGlow 2s ease infinite"}}>
              <span style={{color:"#c8a84b"}}>ALL TEN.</span>
            </div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#c8a84b",opacity:.5,letterSpacing:3,marginBottom:24}}>SECRETS COMPLETE</div>
            <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#7a6a3a",lineHeight:2.1,marginBottom:28}}>
              the konami code. the logo. the title.<br/>
              the word. the stats. the footer.<br/>
              right-clicking a card. scrolling to the bottom.<br/>
              holding the download button. breaking the theme.<br/><br/>
              <span style={{color:"#c8a84b"}}>this is genuinely impressive.</span>
            </p>
            <button onClick={()=>setAllFoundModal(false)} style={{padding:"12px 32px",background:"#c8a84b",color:"#0a0800",border:"none",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,letterSpacing:2,fontWeight:500,filter:"drop-shadow(4px 4px 0 rgba(0,0,0,.5))",transition:"filter .1s, transform .1s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";e.currentTarget.style.filter="drop-shadow(5px 5px 0 rgba(0,0,0,.5))";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.filter="drop-shadow(4px 4px 0 rgba(0,0,0,.5))";}}
              onMouseDown={e=>{e.currentTarget.style.transform="translate(1px,1px)";e.currentTarget.style.filter="drop-shadow(2px 2px 0 rgba(0,0,0,.5))";}}
              onMouseUp={e=>{e.currentTarget.style.transform="translate(-1px,-1px)";e.currentTarget.style.filter="drop-shadow(5px 5px 0 rgba(0,0,0,.5))";}}>
              CLOSE THE VAULT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}