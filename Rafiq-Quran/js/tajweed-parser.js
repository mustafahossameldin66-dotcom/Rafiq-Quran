(function(){
  'use strict';

  const RULES={
    h:{className:'ham_wasl',name:'همزة الوصل',description:'تُثبت في الابتداء وتسقط في الوصل.'},
    s:{className:'silent',name:'حرف ساكن',description:'علامة أداء صامتة بحسب ضبط المصحف.'},
    l:{className:'laam_shamsiyah',name:'لام شمسية',description:'اللام الشمسية المدغمة في الحرف الذي بعدها.'},
    n:{className:'madda_normal',name:'مد طبيعي',description:'مدّ بمقدار حركتين.'},
    p:{className:'madda_permissible',name:'مد جائز',description:'مدّ جائز بحسب موضع الهمز والانفصال في القراءة المعتبرة.'},
    m:{className:'madda_necessary',name:'مد لازم',description:'مدّ لازم بالقدر المقرر في الموضع المعلَّم.'},
    q:{className:'qalqalah',name:'قلقلة',description:'اضطراب صوت الحرف الساكن من حروف قطب جد في الموضع المعلَّم.'},
    o:{className:'madda_obligatory',name:'مد واجب',description:'مدّ واجب بحسب الموضع المعلَّم.'},
    c:{className:'ikhfa_shafawi',name:'إخفاء شفوي',description:'إخفاء الميم الساكنة عند الباء مع الغنة.'},
    f:{className:'ikhfa',name:'إخفاء',description:'النطق بين الإظهار والإدغام مع الغنة.'},
    w:{className:'idgham_shafawi',name:'إدغام شفوي',description:'إدغام الميم الساكنة في الميم مع الغنة.'},
    i:{className:'iqlab',name:'إقلاب',description:'قلب النون الساكنة أو التنوين ميمًا مخفاة عند الباء مع الغنة.'},
    a:{className:'idgham_ghunnah',name:'إدغام بغنة',description:'إدغام النون الساكنة أو التنوين مع الغنة.'},
    u:{className:'idgham_wo_ghunnah',name:'إدغام بغير غنة',description:'إدغام النون الساكنة أو التنوين بلا غنة في اللام أو الراء.'},
    d:{className:'idgham_mutajanisayn',name:'إدغام متجانسين',description:'إدغام الحرفين المتجانسين في الموضع المعلَّم.'},
    b:{className:'idgham_mutaqaribayn',name:'إدغام متقاربين',description:'إدغام الحرفين المتقاربين في الموضع المعلَّم.'},
    g:{className:'ghunnah',name:'غنة',description:'صوت غُنّي ملازم للحكم المعلَّم.'}
  };

  const esc=(v)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function graphemeAt(text, start){
    if(start>=text.length) return {value:'',end:start};
    const cp=text.codePointAt(start);
    const first=String.fromCodePoint(cp);
    let end=start+first.length;
    while(end<text.length){
      const next=text.codePointAt(end);
      const ch=String.fromCodePoint(next);
      if(/\p{Mark}/u.test(ch) || ch==='ـ') end+=ch.length;
      else break;
    }
    return {value:text.slice(start,end),end};
  }

  function mark(code, text, meta){
    const rule=RULES[code]||{className:'unknown',name:'حكم تجويدي',description:'حكم ملوّن وارد من المصدر المرجعي.'};
    return `<span class="tajweed-mark ${rule.className}" data-rule="${esc(rule.className)}" data-code="${esc(code)}" data-name="${esc(rule.name)}" data-description="${esc(rule.description)}"${meta?` data-meta="${esc(meta)}"`:''}>${esc(text)}</span>`;
  }

  function parse(raw){
    const text=String(raw??'');
    if(!text.trim()) return null;
    if(/<\s*tajweed\b/i.test(text) || /class=["'][^"']*\b(?:ham_wasl|madda_normal|qalqalah)\b/i.test(text)){
      // Never trust source HTML. Normalize previously-generated markup through textContent.
      const holder=typeof document!=='undefined' ? document.createElement('div') : null;
      if(holder){
        holder.innerHTML=text;
        const plain=holder.textContent||'';
        return parse(plain);
      }
    }

    let i=0, out='', found=false, hadUnknown=false;
    while(i<text.length){
      const open=text[i]==='[';
      if(!open || !RULES[text[i+1]]){ out+=esc(text[i]); i++; continue; }

      const code=text[i+1];
      const afterCode=i+2;
      // Canonical API form: [h:9421[ٱ]
      if(text[afterCode]===':'){
        const firstOpen=text.indexOf('[',afterCode+1);
        const firstClose=text.indexOf(']',afterCode+1);
        if(firstOpen!==-1 && firstClose!==-1 && firstOpen<firstClose){
          const meta=text.slice(afterCode+1,firstOpen);
          const end=text.indexOf(']',firstOpen+1);
          if(end!==-1){
            const token=text.slice(firstOpen+1,end);
            if(token){out+=mark(code,token,meta);found=true;i=end+1;continue;}
          }
        }
        // Marker-only legacy form: [h:9421] followed by the marked grapheme.
        const close=firstClose;
        if(close!==-1){
          const g=graphemeAt(text,close+1);
          if(g.value){out+=mark(code,g.value,text.slice(afterCode+1,close));found=true;i=g.end;continue;}
        }
      }

      // Compact form: [l[ل]
      if(text[afterCode]==='['){
        const end=text.indexOf(']',afterCode+1);
        if(end!==-1){
          const token=text.slice(afterCode+1,end);
          if(token){out+=mark(code,token);found=true;i=end+1;continue;}
        }
      }

      hadUnknown=true;
      out+=esc(text[i]);
      i++;
    }

    // A source-marked payload must never leak raw control markers into the UI.
    if(/\[[hslnpmqocfwiabdg](?::|\[)/u.test(text)) return hadUnknown && !found ? null : out.replace(/\[[hslnpmqocfwiabdg](?::[^\]]*|\[[^\]]*)\]/gu,'');
    return found?out:esc(text);
  }

  function sanitizeHtml(html){
    const parsed=parse(html);
    if(!parsed || /\[[hslnpmqocfwiabdg](?::|\[)/u.test(parsed)) return null;
    return parsed;
  }

  window.RAFIQ_TAJWEED={RULES,parse,sanitizeHtml};
})();
