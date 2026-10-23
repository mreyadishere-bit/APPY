/* Real .docx packages, generated locally. No upload, service or runtime dependency. */
import { sanitize, formatDate, titleOf, moodLabel } from "../core/model.js";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const encoder = new TextEncoder();
const xml = value => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
const rtl = text => /^[^A-Za-z\u0590-\u08ff]*[\u0590-\u08ff]/u.test(text || "");

function fontAvailable(name) {
  const context = document.createElement("canvas").getContext("2d");
  const sample = "WWWWmmmmii APPY 012345";
  return ["monospace", "sans-serif", "serif"].some(base => {
    context.font = `72px ${base}`;
    const fallback = context.measureText(sample).width;
    context.font = `72px "${name}", ${base}`;
    return Math.abs(context.measureText(sample).width - fallback) > 0.1;
  });
}

function color(value, fallback) {
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.fillStyle = `#${fallback}`;
  ctx.fillStyle = value;
  const normalized = ctx.fillStyle;
  if (/^#[\da-f]{6}$/i.test(normalized)) return normalized.slice(1);
  const digits = normalized.match(/[\d.]+/g);
  return digits?.length >= 3 ? digits.slice(0, 3).map(n => Math.round(+n).toString(16).padStart(2,"0")).join("") : fallback;
}

export function readerWordStyle(book, source = document.documentElement) {
  const probe = document.createElement("div");
  probe.className = "reader";
  probe.style.cssText = "display:none;animation:none";
  source.append(probe);
  const css = getComputedStyle(probe);
  const stack = css.getPropertyValue("--serif").split(",").map(n => n.trim().replace(/^["']|["']$/g, ""));
  const concrete = stack.filter(n => !/^(serif|sans-serif|system-ui|ui-serif|ui-sans-serif)$/i.test(n));
  const font = [...concrete, "Times New Roman", "Liberation Serif"].find(fontAvailable) || "Georgia";
  const sans = ["Segoe UI", "Arial", "Liberation Sans"].find(fontAvailable) || "Arial";
  const palette = {
    font, sans, paper: color(css.getPropertyValue("--surface"), "FFFDF7"),
    ink: color(css.getPropertyValue("--ink"), "1A1710"),
    text: color(css.getPropertyValue("--ink-2"), "3F3A30"),
    accent: color(css.getPropertyValue("--clay"), "9C4A2F"),
    muted: color(css.getPropertyValue("--faint"), "9B9484"),
    foil: book.cover?.style === "paper" ? "33291A" : color(css.getPropertyValue("--cover-foil"), "E6D8B4"),
    cover: color(book.cover?.accent || css.getPropertyValue(`--cover-${book.cover?.style || "cloth"}`), "3F4F5C"),
    size: Math.round(24 * Number(getComputedStyle(source).getPropertyValue("--reader-scale") || 1)),
  };
  probe.remove();
  return palette;
}

function pageArt(fill, cover = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 850; canvas.height = 1100;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = `#${fill}`; ctx.fillRect(0, 0, 850, 1100);
  ctx.fillStyle = cover ? "#ffffff09" : "#94774904";
  for (let y = 0; y < 1100; y += cover ? 4 : 3) ctx.fillRect(0, y, 850, 1);
  if (cover) {
    ctx.fillStyle = "#0000000c";
    for (let x = 0; x < 850; x += 4) ctx.fillRect(x, 0, 1, 1100);
  }
  const gradient = ctx.createLinearGradient(0, 0, cover ? 40 : 32, 0);
  gradient.addColorStop(0, cover ? "#00000070" : "#301c1533");
  gradient.addColorStop(1, "#00000000");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 40, 1100);
  return new Promise((resolve, reject) => canvas.toBlob(async blob => {
    if (!blob) return reject(new Error("The cover could not be prepared."));
    resolve(new Uint8Array(await blob.arrayBuffer()));
  }, "image/png"));
}

// ZIP STORE is supported by Word and avoids a network or compressor dependency.
function zip(files) {
  const table = Uint32Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  const chunks = [], directory = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const path = encoder.encode(name), data = typeof content === "string" ? encoder.encode(content) : content;
    let crc = 0xffffffff;
    for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = new Uint8Array(30 + path.length), view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true);
    view.setUint16(12, 0x21, true); view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, path.length, true); header.set(path, 30);
    chunks.push(header, data);
    const central = new Uint8Array(46 + path.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true);
    cv.setUint16(14, 0x21, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, path.length, true); cv.setUint32(42, offset, true); central.set(path, 46);
    directory.push(central); offset += header.length + data.length;
  }
  const length = directory.reduce((n, b) => n + b.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, directory.length, true); ev.setUint16(10, directory.length, true);
  ev.setUint32(12, length, true); ev.setUint32(16, offset, true);
  return new Blob([...chunks, ...directory, end], { type: MIME });
}

function backgroundHeader(id) {
  return `${XML}<w:hdr xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:p><w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="7772400" cy="10058400"/><wp:wrapNone/><wp:docPr id="${id}" name="Paper background" descr="Decorative book paper"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="Paper"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="art"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="7772400" cy="10058400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p></w:hdr>`;
}

export async function buildBookWord(book, entries, palette) {
  const p = palette || readerWordStyle(book);
  const links = [], nums = [];
  const fonts = `<w:rFonts w:ascii="${xml(p.font)}" w:hAnsi="${xml(p.font)}" w:eastAsia="${xml(p.font)}" w:cs="${xml(p.font)}"/>`;
  const run = (text, props = "", font = p.font) => `<w:r><w:rPr>${fonts.replaceAll(xml(p.font),xml(font))}${props}${/[\u0590-\u08ff]/u.test(text) ? '<w:rtl/>' : ''}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
  const para = (content, style = "Normal", text = "", props = "") => `<w:p><w:pPr><w:pStyle w:val="${style}"/>${rtl(text) ? '<w:bidi/><w:jc w:val="start"/>' : ''}${props}</w:pPr>${content || run("")}</w:p>`;
  function inline(node, props = "") {
    if (node.nodeType === 3) return run(node.nodeValue, props);
    if (node.nodeType !== 1) return "";
    const tag = node.tagName;
    const formats = { STRONG: '<w:b/><w:bCs/>', EM: '<w:i/><w:iCs/>', U:'<w:u w:val="single"/>', S:'<w:strike/>', MARK:'<w:color w:val="1A1710"/><w:highlight w:val="yellow"/>' };
    if (tag === "BR") return '<w:r><w:br/></w:r>';
    const children = [...node.childNodes].map(n => inline(n, props + (formats[tag] || ""))).join("");
    if (tag === "A") {
      const target = node.getAttribute("href");
      if (!/^(https?:|mailto:)/i.test(target || "")) return children;
      const id = `link${links.length + 1}`; links.push({id,target});
      return `<w:hyperlink r:id="${id}">${[...node.childNodes].map(n => inline(n, props + `<w:color w:val="${p.accent}"/><w:u w:val="single"/>`)).join("")}</w:hyperlink>`;
    }
    return children;
  }
  function blocks(parent, level = 0) {
    const result = []; let pending = [];
    const flush = () => { if (pending.length) { const text = pending.map(n=>n.textContent).join(""); if(text.trim()) result.push(para(pending.map(n=>inline(n)).join(""),"Normal",text)); pending=[]; } };
    for (const node of parent.childNodes) {
      if (node.nodeType !== 1) { pending.push(node); continue; }
      const tag = node.tagName;
      if (["UL","OL"].includes(tag)) {
        flush(); const num = nums.length + 1; nums.push({id:num,ordered:tag === "OL"});
        for (const li of node.children) {
          if (li.tagName !== "LI") continue;
          const content = [...li.childNodes].filter(n => !["UL","OL"].includes(n.tagName));
          result.push(para(content.map(n=>inline(n)).join(""),"Normal",li.textContent,`<w:numPr><w:ilvl w:val="${Math.min(8,level)}"/><w:numId w:val="${num}"/></w:numPr>`));
          for (const nested of [...li.children].filter(n=>["UL","OL"].includes(n.tagName))) {
            const wrapper=document.createElement("div"); wrapper.append(nested.cloneNode(true)); result.push(blocks(wrapper,level+1));
          }
        }
      } else if (["P","H3","H4","BLOCKQUOTE","DIV"].includes(tag)) {
        flush();
        if (tag === "DIV" || tag === "BLOCKQUOTE" && node.querySelector("p,div")) result.push(blocks(node,level));
        else result.push(para(inline(node),tag === "H3" ? "Heading2" : tag === "H4" ? "Heading3" : tag === "BLOCKQUOTE" ? "Quote" : "Normal",node.textContent));
      } else pending.push(node);
    }
    flush(); return result.join("");
  }
  const colorRun = (value,size) => `<w:color w:val="${value}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
  const section = (cover=false) => `<w:sectPr><w:headerReference w:type="default" r:id="${cover ? 'coverHeader' : 'paperHeader'}"/><w:footerReference w:type="default" r:id="${cover ? 'emptyFooter' : 'folioFooter'}"/><w:type w:val="nextPage"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1200" w:header="0" w:footer="480"/>${cover?'':'<w:pgNumType w:start="1"/>'}</w:sectPr>`;
  let body = para(run("DIARY",colorRun(p.foil,20),p.sans),"Normal","",'<w:spacing w:before="1500" w:after="700"/>');
  body += para(run(book.title,colorRun(p.foil,64)+'<w:b w:val="0"/><w:bCs w:val="0"/>'),"Title",book.title,'<w:spacing w:after="420"/>');
  if(book.subtitle) body += para(run(book.subtitle,colorRun(p.foil,26),p.sans),"Normal",book.subtitle);
  body += para(run(`${entries.length} ${entries.length===1?'entry':'entries'}`,colorRun(p.foil,20)),"Normal","",'<w:spacing w:before="800"/>');
  body += `<w:p><w:pPr>${section(true)}</w:pPr></w:p>`;
  entries.forEach((entry,i) => {
    body += para(run(formatDate(entry.date,"full").toUpperCase(),colorRun(p.accent,18),p.sans),"Date","",`${i?'<w:pageBreakBefore/>':''}<w:keepNext/>`);
    if(entry.mood) body += para(run(moodLabel(entry.mood),colorRun(p.muted,18)),"Date","",'<w:keepNext/>');
    body += para(run(titleOf(entry)),"Heading1",titleOf(entry));
    const doc = new DOMParser().parseFromString(sanitize(entry.body),"text/html");
    body += blocks(doc.body);
    body += para(run("END OF ENTRY",colorRun(p.muted,16),p.sans),"End");
  });
  if(!entries.length) body += para(run("The book is empty, for now."),"Normal");
  const style = (id, name, size, fill, extra="", paragraph="") => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:pPr>${paragraph}</w:pPr><w:rPr>${fonts}${colorRun(fill,size)}${extra}</w:rPr></w:style>`;
  const styles = `${XML}<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr>${fonts}${colorRun(p.text,p.size)}<w:lang w:val="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="200" w:line="400" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${style('Title','Title',64,p.foil,'','<w:keepNext/>')}${style('Heading1','heading 1',42,p.ink,'<w:b w:val="0"/><w:bCs w:val="0"/>','<w:keepNext/><w:spacing w:before="140" w:after="320"/><w:outlineLvl w:val="0"/>')}${style('Heading2','heading 2',30,p.ink,'<w:b w:val="0"/><w:bCs w:val="0"/>','<w:keepNext/><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="1"/>')}${style('Heading3','heading 3',24,p.ink,'<w:b/>','<w:keepNext/><w:spacing w:before="240" w:after="120"/>')}${style('Quote','Quote',p.size,p.ink,'<w:i/>','<w:ind w:left="360" w:right="240"/>')}${style('Date','Date',18,p.accent)}${style('End','End',16,p.muted,'','<w:spacing w:before="360" w:after="0"/>')}</w:styles>`;
  const numXml = nums.map(n=>`<w:abstractNum w:abstractNumId="${n.id}">${Array.from({length:9},(_,i)=>`<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${n.ordered?'decimal':'bullet'}"/><w:lvlText w:val="${n.ordered?`%${i+1}.`:'•'}"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="${(i+1)*360}"/></w:tabs><w:ind w:left="${(i+1)*360}" w:hanging="240"/></w:pPr></w:lvl>`).join('')}</w:abstractNum>`).join('')+nums.map(n=>`<w:num w:numId="${n.id}"><w:abstractNumId w:val="${n.id}"/></w:num>`).join('');
  const relationship = (id,type,target,external=false) => `<Relationship Id="${id}" Type="${R}/${type}" Target="${xml(target)}"${external?' TargetMode="External"':''}/>`;
  const rels = content => `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${content}</Relationships>`;
  const overrides = { 'document':'document.main',styles:'styles',numbering:'numbering',settings:'settings',fontTable:'fontTable',header1:'header',header2:'header',footer1:'footer',footer2:'footer' };
  const [coverArt,paperArt] = await Promise.all([pageArt(p.cover,true),pageArt(p.paper)]);
  const files = {
    '[Content_Types].xml':`${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>${Object.entries(overrides).map(([name,type])=>`<Override PartName="/word/${name}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${type}+xml"/>`).join('')}</Types>`,
    '_rels/.rels':rels(relationship('office','officeDocument','word/document.xml')),
    'word/document.xml':`${XML}<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${body}${section()}</w:body></w:document>`,
    'word/styles.xml':styles,
    'word/numbering.xml':`${XML}<w:numbering xmlns:w="${W}">${numXml}</w:numbering>`,
    'word/settings.xml':`${XML}<w:settings xmlns:w="${W}"><w:displayBackgroundShape/><w:evenAndOddHeaders w:val="0"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`,
    'word/fontTable.xml':`${XML}<w:fonts xmlns:w="${W}"><w:font w:name="${xml(p.font)}"><w:family w:val="roman"/></w:font></w:fonts>`,
    'word/header1.xml':backgroundHeader(1), 'word/header2.xml':backgroundHeader(2),
    'word/footer1.xml':`${XML}<w:ftr xmlns:w="${W}"><w:p/></w:ftr>`,
    'word/footer2.xml':`${XML}<w:ftr xmlns:w="${W}">${para(`<w:fldSimple w:instr="PAGE">${run('1',colorRun(p.muted,18))}</w:fldSimple>`,'Normal','', '<w:jc w:val="center"/>')}</w:ftr>`,
    'word/media/cover.png':coverArt, 'word/media/paper.png':paperArt,
    'word/_rels/header1.xml.rels':rels(relationship('art','image','media/cover.png')),
    'word/_rels/header2.xml.rels':rels(relationship('art','image','media/paper.png')),
    'word/_rels/document.xml.rels':rels(relationship('styles','styles','styles.xml')+relationship('numbering','numbering','numbering.xml')+relationship('settings','settings','settings.xml')+relationship('fonts','fontTable','fontTable.xml')+relationship('coverHeader','header','header1.xml')+relationship('paperHeader','header','header2.xml')+relationship('emptyFooter','footer','footer1.xml')+relationship('folioFooter','footer','footer2.xml')+links.map(l=>relationship(l.id,'hyperlink',l.target,true)).join('')),
  };
  // Canonical property order keeps the package compatible with strict OOXML readers.
  const order = {
    pPr: "pStyle keepNext keepLines pageBreakBefore framePr widowControl numPr suppressLineNumbers pBdr shd tabs suppressAutoHyphens kinsoku wordWrap overflowPunct topLinePunct autoSpaceDE autoSpaceDN bidi adjustRightInd snapToGrid spacing ind contextualSpacing mirrorIndents suppressOverlap jc textDirection textAlignment textboxTightWrap outlineLvl divId cnfStyle rPr sectPr pPrChange",
    rPr: "rStyle rFonts b bCs i iCs caps smallCaps strike dstrike outline shadow emboss imprint noProof snapToGrid vanish webHidden color spacing w kern position sz szCs highlight u effect bdr shd fitText vertAlign rtl cs em lang eastAsianLayout specVanish oMath",
    sectPr: "headerReference footerReference footnotePr endnotePr type pgSz pgMar paperSrc pgBorders lnNumType pgNumType cols formProt vAlign noEndnote titlePg textDirection bidi rtlGutter docGrid printerSettings",
  };
  for (const [name,content] of Object.entries(files)) {
    if (!name.endsWith('.xml') || typeof content !== 'string') continue;
    const doc = new DOMParser().parseFromString(content,'application/xml');
    for (const [tag,sequence] of Object.entries(order)) {
      const keys = sequence.split(' ');
      for (const node of [...doc.getElementsByTagNameNS(W,tag)]) {
        const children = [...node.children];
        // A run property can be overridden by a nested format such as a highlighted link.
        const unique = children.filter((child,i) => tag !== 'rPr' || !children.slice(i+1).some(n=>n.localName===child.localName));
        children.forEach(child=>child.remove());
        unique.sort((a,b)=>keys.indexOf(a.localName)-keys.indexOf(b.localName)).forEach(child=>node.append(child));
      }
    }
    files[name] = new XMLSerializer().serializeToString(doc);
  }
  return zip(files);
}

export function wordFilename(title) {
  const safe = String(title || 'Book').replace(/[<>:"/\\|?*\u0000-\u001f]/g,' ').trim().replace(/[. ]+$/g,'').slice(0,100) || 'Book';
  return `${safe}.docx`;
}
