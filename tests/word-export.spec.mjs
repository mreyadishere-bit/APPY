import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ acceptDownloads:true });
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:8123/');
  await page.waitForFunction(async()=> (await import('/src/core/store.js')).state.ready);
  await page.evaluate(async()=>{
    const store=await import('/src/core/store.js');
    store.state.books=[{id:'word-test',title:'A quiet place for my days',subtitle:'Thoughts and small discoveries',cover:{style:'cloth',accent:'#3f4f5c'}}];
    store.state.entries=[
      {id:'e1',bookId:'word-test',date:'2026-10-21',createdAt:1,title:'A quiet place for your days',body:'<p>This is <strong>APPY</strong>, a diary that lives entirely in this browser. <em>A quiet place for your thoughts.</em></p><p>Write your moments, keep them in books, and come back whenever you like.</p><h3>Small things worth keeping</h3><ul><li>A good conversation</li><li>A new idea<ul><li>A detail to remember</li></ul></li></ul><blockquote>Some days deserve to be remembered.</blockquote><p><a href="https://example.com/?a=1&amp;b=2">A useful link</a> and <u>underlined</u>, <s>changed</s>, <mark>highlighted</mark> words.<br>A fresh line.</p>'},
      {id:'e2',bookId:'word-test',date:'2026-10-22',createdAt:2,title:'أيام تستحق أن تُروى',body:'<p>هذه يومياتي، أكتب فيها لحظاتي وأفكاري باللغة العربية. <strong>نص عربي عريض</strong> وكلمات English داخل الفقرة.</p><ol><li>لحظة جميلة</li><li>فكرة جديدة</li></ol>'},
      {id:'e3',bookId:'word-test',date:'2026-10-23',createdAt:3,title:'An entry that grows with the day',body:Array.from({length:28},(_,i)=>`<p>Paragraph ${i+1}. The pages should grow naturally as the story continues. Longer entries stay complete, with room for every word and enough space to read comfortably.</p>`).join('')},
      {id:'deleted',bookId:'word-test',date:'2026-10-20',createdAt:0,title:'Do not export',body:'<p>DELETED_SECRET</p>',deletedAt:123},
    ];
    location.hash='#/book/word-test';
  });
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="word"]').click()]);
  assert.equal(download.suggestedFilename(),'A quiet place for my days.docx');
  await fs.mkdir('/tmp/appy-word-qa',{recursive:true});
  await download.saveAs('/tmp/appy-word-qa/book.docx');
  const bytes=new Uint8Array(await fs.readFile('/tmp/appy-word-qa/book.docx'));
  const parsed=await page.evaluate(async data=>{
    const bytes=new Uint8Array(data), view=new DataView(bytes.buffer), files={}; let offset=0;
    while(view.getUint32(offset,true)===0x04034b50){
      const length=view.getUint32(offset+18,true), nameLen=view.getUint16(offset+26,true), extra=view.getUint16(offset+28,true);
      const name=new TextDecoder().decode(bytes.slice(offset+30,offset+30+nameLen));
      const start=offset+30+nameLen+extra;
      if(name.endsWith('.xml')||name.endsWith('.rels'))files[name]=new TextDecoder().decode(bytes.slice(start,start+length));
      offset=start+length;
    }
    const failures=Object.entries(files).filter(([,text])=>new DOMParser().parseFromString(text,'application/xml').querySelector('parsererror')).map(([name])=>name);
    return {files,failures};
  },[...bytes]);
  assert.deepEqual(parsed.failures,[]);
  const main=parsed.files['word/document.xml'];
  assert.ok(main.includes('أيام تستحق أن تُروى'));
  assert.ok(main.indexOf('A quiet place for your days')<main.indexOf('أيام تستحق أن تُروى'));
  assert.ok(main.includes('Paragraph 28.'));
  assert.ok(!main.includes('DELETED_SECRET'));
  for(const tag of ['<w:b/>','<w:i/>','<w:hyperlink','<w:numPr>','<w:bidi/>','<w:pageBreakBefore/>'])assert.ok(main.includes(tag),tag);
  assert.ok(parsed.files['word/_rels/document.xml.rels'].includes('a=1&amp;b=2'));
  assert.ok(parsed.files['word/styles.xml'].includes('<w:rFonts'));
  // Reader button and the same export on a dark background.
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark';location.hash='#/read/word-test';});
  await page.locator('[data-cover]').waitFor({state:'detached'});
  const [dark]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="word"]').click()]);
  await dark.saveAs('/tmp/appy-word-qa/dark.docx');
  await page.evaluate(async()=>{
    const {buildBookWord,readerWordStyle}=await import('/src/export/word.js');
    if(readerWordStyle({cover:{style:'paper'}}).foil !== '33291A') throw new Error('Paper cover needs dark lettering');
    const book={title:'Empty book',cover:{style:'linen'}};
    const blob=await buildBookWord(book,[],readerWordStyle(book));
    if(blob.size<1000)throw new Error('Empty export is invalid');
  });
  assert.deepEqual(errors,[]);
  console.log('Word export: real downloads, valid XML, formatting, RTL, lists, links, complete live entries, dark and empty books passed.');
} finally { await browser.close(); }
