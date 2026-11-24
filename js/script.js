(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var pad=function(n){return String(n).padStart(2,'0')};
var iso=function(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
var today=function(){return iso(new Date())};
var addDays=function(s,n){var d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return iso(d)};
var diffDays=function(a,b){return Math.round((new Date(a+'T12:00:00')-new Date(b+'T12:00:00'))/864e5)};
var fmtDate=function(s){return s?new Date(s+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'-'};
var r2=function(n){return Math.round((n+Number.EPSILON)*100)/100};
var CURS=['INR','USD','EUR','GBP','AED','AUD','CAD','SGD'];
function money(n,cur){try{return new Intl.NumberFormat(cur==='INR'?'en-IN':'en-US',{style:'currency',currency:cur||'INR'}).format(n||0)}catch(e){return (cur||'')+' '+(n||0).toFixed(2)}}
function compact(n,cur){try{return new Intl.NumberFormat(cur==='INR'?'en-IN':'en-US',{notation:'compact',maximumFractionDigits:1}).format(n)}catch(e){return String(n)}}
function uid(){return 'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

/* ---------- storage ---------- */
var KEY='invoicepro.v1', store,storageBlocked=false,storageMessage='';
function validProfile(p){
  return p&&typeof p==='object'&&typeof p.name==='string'&&typeof p.email==='string'&&
    typeof p.phone==='string'&&typeof p.address==='string'&&typeof p.taxId==='string'&&
    typeof p.payment==='string'&&typeof p.prefix==='string'&&CURS.indexOf(p.currency)>-1&&
    typeof p.tax==='number'&&isFinite(p.tax)&&typeof p.terms==='number'&&isFinite(p.terms);
}
function validInvoice(i){
  return i&&typeof i==='object'&&typeof i.id==='string'&&typeof i.number==='string'&&
    i.client&&typeof i.client==='object'&&typeof i.client.name==='string'&&
    typeof i.client.email==='string'&&typeof i.client.address==='string'&&Array.isArray(i.items)&&
    validDate(i.issue)&&validDate(i.due)&&CURS.indexOf(i.currency)>-1&&
    typeof i.discount==='number'&&isFinite(i.discount)&&typeof i.tax==='number'&&isFinite(i.tax)&&
    i.items.every(function(item){return item&&typeof item.d==='string'&&typeof item.q==='number'&&isFinite(item.q)&&typeof item.r==='number'&&isFinite(item.r)})&&
    ['draft','sent','paid'].indexOf(i.status)>-1;
}
function load(){
  var raw;
  try{raw=localStorage.getItem(KEY)}catch(e){storageBlocked=true;storageMessage='Invoice storage is unavailable. Changes cannot be saved in this browser.';return null}
  if(!raw)return null;
  try{
    var data=JSON.parse(raw);
    if(data&&validProfile(data.profile)&&Array.isArray(data.invoices)&&data.invoices.every(validInvoice)){
      data.clients=Array.isArray(data.clients)?data.clients:[];
      data.expenses=Array.isArray(data.expenses)?data.expenses:[];
      data.recurring=Array.isArray(data.recurring)?data.recurring:[];
      data.reminders=Array.isArray(data.reminders)?data.reminders:[];
      data.notifications=Array.isArray(data.notifications)?data.notifications:[];
      data.activity=Array.isArray(data.activity)?data.activity:[];
      data.preferences=data.preferences&&typeof data.preferences==='object'?data.preferences:{};
      data.document=data.document&&typeof data.document==='object'?data.document:{template:'modern',color:'#2447D6',footer:'',showTax:true,logo:''};
      data.reminderTemplate=typeof data.reminderTemplate==='string'?data.reminderTemplate:'Dear {client}, this is a friendly reminder that invoice {invoice} for {amount} is due {due}. Kindly arrange payment at your earliest convenience.';
      data.invoices.forEach(function(invoice){if(!Array.isArray(invoice.payments))invoice.payments=[]});
      return data;
    }
  }catch(e){}
  storageBlocked=true;
  storageMessage='Saved invoice data is unreadable and has not been overwritten. Reset it only if you want to discard it and start fresh.';
  return null;
}
function persist(){
  if(storageBlocked){toast(storageMessage);return false}
  try{localStorage.setItem(KEY,JSON.stringify(store));return true}
  catch(e){toast('Invoice data could not be saved. Check available browser storage and try again.');return false}
}
function seed(){
  var t=today();
  function mk(n,client,email,issueOff,terms,items,disc,tax,status,paidOff){
    var issue=addDays(t,issueOff);
    return {id:uid(),number:'INV-'+pad(n).padStart(4,'0'),client:{name:client,email:email,address:''},issue:issue,due:addDays(issue,terms),currency:'INR',
      items:items.map(function(x){return {d:x[0],q:x[1],r:x[2]}}),discount:disc,tax:tax,notes:'',status:status,paidOn:paidOff==null?'':addDays(t,paidOff),sample:true};
  }
  return {profile:{name:'',email:'',phone:'',address:'',taxId:'',currency:'INR',tax:18,terms:15,prefix:'INV-',payment:''},
    clients:[],expenses:[],recurring:[],reminders:[],notifications:[],activity:[],
    reminderTemplate:'Dear {client}, this is a friendly reminder that invoice {invoice} for {amount} is due {due}. Kindly arrange payment at your earliest convenience.',
    preferences:{visible:{stats:true,chart:true,recent:true},order:['stats','chart','recent'],defaultView:'dashboard'},
    document:{template:'modern',color:'#2447D6',footer:'',showTax:true,logo:''},
    invoices:[
      mk(1,'Kaveri Textiles Pvt Ltd','accounts@kaveritextiles.example',-150,15,[['Quarterly bookkeeping',1,28000],['GST return filing',3,2500]],0,18,'paid',-132),
      mk(2,'Brightline Labs','finance@brightline.example',-118,15,[['Website maintenance retainer',1,15000]],0,18,'paid',-101),
      mk(3,'Anand & Rao Associates','anand@anandrao.example',-90,30,[['Brand identity system',1,45000],['Stationery set',1,12000]],5,18,'paid',-66),
      mk(4,'Studio Meridian','hello@meridian.example',-58,15,[['Product photography, full day',2,9000],['Retouching (per image)',24,350]],0,18,'sent'),
      mk(5,'Lotus Café Group','owner@lotuscafe.example',-31,15,[['Menu design',1,18000],['Print-ready files',1,3500]],0,18,'sent'),
      mk(6,'Orbit Logistics','ap@orbitlogistics.example',-9,15,[['Dashboard design, 6 screens',6,8500]],5,18,'sent'),
      mk(7,'Kaveri Textiles Pvt Ltd','accounts@kaveritextiles.example',-1,15,[['Quarterly bookkeeping',1,28000]],0,18,'draft')
    ]};
}
store=load()||seed();

/* ---------- logic ---------- */
function calc(inv){
  var sub=r2((inv.items||[]).reduce(function(a,i){return a+r2((+i.q||0)*(+i.r||0))},0));
  var disc=r2(sub*(+inv.discount||0)/100), taxable=r2(sub-disc), tax=r2(taxable*(+inv.tax||0)/100);
  return {sub:sub,disc:disc,tax:tax,total:r2(taxable+tax)};
}
function paidAmount(inv){
  if(Array.isArray(inv.payments)&&inv.payments.length)return r2(inv.payments.reduce(function(sum,p){return sum+(p.voided?0:(+p.amount||0))},0));
  return inv.status==='paid'?calc(inv).total:0;
}
function balance(inv){return Math.max(0,r2(calc(inv).total-paidAmount(inv)))}
function recordActivity(type,description,relatedId){
  store.activity.unshift({id:uid(),type:type,description:description,relatedId:relatedId||'',at:new Date().toISOString()});
  if(store.activity.length>500)store.activity.length=500;
}
function statusOf(inv){return inv.status==='sent'&&inv.due<today()?'overdue':inv.status}
var LABEL={draft:'Draft',sent:'Sent',overdue:'Overdue',paid:'Paid'};
function pill(s){var safe=LABEL[s]?s:'draft';return '<span class="pill s-'+safe+'">'+LABEL[safe]+'</span>'}
function nextNumber(){
  var p=store.profile.prefix||'INV-',max=0;
  store.invoices.forEach(function(i){if(i.number.indexOf(p)===0){var n=parseInt(i.number.slice(p.length),10);if(n>max)max=n}});
  return p+String(max+1).padStart(4,'0');
}
function dueNote(inv){
  var s=statusOf(inv),d=diffDays(inv.due,today());
  if(s==='paid')return 'Paid '+fmtDate(inv.paidOn);
  if(s==='draft')return 'Draft';
  if(s==='overdue')return Math.abs(d)+(Math.abs(d)===1?' day':' days')+' overdue';
  return d===0?'Due today':'Due in '+d+(d===1?' day':' days');
}
function validDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
  var date=new Date(value+'T12:00:00');
  return !isNaN(date.getTime())&&iso(date)===value;
}
function toast(msg){var t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(function(){t.hidden=true},2400)}
function hasSamples(){return store.invoices.some(function(i){return i.sample})}

/* ---------- invoice document ---------- */
function docHTML(inv,prof,example){
  var c=calc(inv),s=statusOf(inv),cur=inv.currency,settings=store.document||{},template=settings.template||'modern';
  var rows=inv.items.map(function(i){return '<tr><td>'+esc(i.d)+'</td><td class="r num">'+esc(i.q)+'</td><td class="r num">'+money(i.r,cur)+'</td><td class="r num">'+money(r2(i.q*i.r),cur)+'</td></tr>'}).join('');
  var from=[prof.address,prof.email,prof.phone,prof.taxId?'GSTIN / Tax ID: '+prof.taxId:''].filter(Boolean).map(esc).join('<br>');
  return '<div class="doc template-'+esc(template)+'" style="--doc-accent:'+esc(settings.color||'#2447D6')+'"><div class="doc-top"><div>'+(settings.logo?'<img class="doc-logo" src="'+esc(settings.logo)+'" alt="Business logo">':'')+'<div class="doc-brand"><i aria-hidden="true">₹</i> InvoicePro</div><h3>'+esc(prof.name||'Your business name')+'</h3><div class="muted">'+(from||'Add your details under Business')+'</div></div>'+
    '<div><div class="big">INVOICE</div><div class="r num muted" style="text-align:right">'+esc(inv.number)+'</div><div style="text-align:right;margin-top:6px">'+pill(s)+'</div></div></div>'+
    '<div class="meta"><div><b>Billed to</b>'+esc(inv.client.name||'-')+'<div class="muted">'+esc(inv.client.email)+(inv.client.address?'<br>'+esc(inv.client.address).replace(/\n/g,'<br>'):'')+'</div></div>'+
    '<div><b>Issued</b>'+fmtDate(inv.issue)+'</div><div><b>Due</b>'+fmtDate(inv.due)+'</div></div>'+
    '<div class="scroll"><table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<div class="tt num"><div><span class="muted">Subtotal</span><span>'+money(c.sub,cur)+'</span></div>'+
    (inv.discount?'<div><span class="muted">Discount ('+inv.discount+'%)</span><span>-'+money(c.disc,cur)+'</span></div>':'')+
    (inv.tax&&settings.showTax!==false?'<div><span class="muted">Tax ('+inv.tax+'%)</span><span>'+money(c.tax,cur)+'</span></div>':'')+
    '<div class="g"><span>Total</span><span>'+money(c.total,cur)+'</span></div></div>'+
    (inv.notes?'<div class="note"><b>Notes</b><br>'+esc(inv.notes)+'</div>':'')+
    (prof.payment?'<div class="note"><b>Payment details</b><br>'+esc(prof.payment)+'</div>':'')+
    (settings.footer?'<div class="doc-footer">'+esc(settings.footer)+'</div>':'')+'</div>';
}

/* ---------- views ---------- */
function homeView(){
  var ex={number:'INV-0042',client:{name:'Orbit Logistics',email:'ap@orbitlogistics.example',address:''},issue:addDays(today(),-4),due:addDays(today(),11),currency:'INR',
    items:[{d:'Brand identity system',q:1,r:45000},{d:'Website design, 6 pages',q:6,r:8500}],discount:5,tax:18,notes:'',status:'sent'};
  var exp={name:'Meridian Design Studio',address:'14 Church Street, Bengaluru',email:'billing@meridian.example',phone:'',taxId:'',payment:''};
  return '<section class="hero"><div><div class="eyebrow">Invoice and billing system</div>'+
    '<h1 style="margin-top:12px">Send the invoice. Know when it is paid.</h1>'+
    '<p class="lead">InvoicePro works out totals and GST, numbers your invoices, and flags the ones that are late, so billing takes minutes instead of an evening.</p>'+
    '<div class="cta"><a class="btn primary" href="#dashboard">Open InvoicePro</a><a class="btn" href="#new">Create an invoice</a></div></div>'+
    '<div>'+docHTML(ex,exp)+'<div class="cap">Example invoice. Totals are calculated as you type.</div></div></section>'+
    '<section class="feat" aria-label="Features">'+
    '<div><h3>Totals that add up</h3><p>Line items, percentage discount and GST or any tax rate. Subtotal, tax and total update live.</p></div>'+
    '<div><h3>Late invoices flagged</h3><p>An invoice past its due date turns Overdue on its own, with the number of days late.</p></div>'+
    '<div><h3>Numbering handled</h3><p>New invoices get the next number in your series. Duplicate a past invoice for repeat work.</p></div>'+
    '<div><h3>Dashboard at a glance</h3><p>See what is outstanding, what is overdue and what was paid this month, plus six months of billing.</p></div>'+
    '<div><h3>Eight currencies</h3><p>Bill in rupees, dollars, euros, pounds and more. Amounts use local number formatting.</p></div>'+
    '<div><h3>Private by design</h3><p>Your invoices and business details stay in this browser on this device. Nothing is uploaded.</p></div></section>'+
    '<h2 class="sec-h">Your first invoice in three steps</h2>'+
    '<section class="steps"><div class="card"><span class="n">Step 1</span><h3>Add your business</h3><p class="muted">Name, address, tax ID, default tax rate and payment details appear on every invoice.</p></div>'+
    '<div class="card"><span class="n">Step 2</span><h3>Create the invoice</h3><p class="muted">Pick a client, add line items, set the due date. Save as a draft or mark it sent.</p></div>'+
    '<div class="card"><span class="n">Step 3</span><h3>Track until paid</h3><p class="muted">Mark it paid when the money arrives. Overdue ones stay at the top of your dashboard.</p></div></section>'+
    '<div class="band"><div><h2>Ready to bill your next client?</h2><p class="muted">Sample invoices are loaded so you can look around first. Clear them any time.</p></div>'+
    '<a class="btn primary" href="#dashboard">Open the dashboard</a></div>'+
    '<footer><span>InvoicePro · Smart Invoice &amp; Billing System</span><span>Data stays in your browser.</span></footer>';
}

function bannerHTML(){
  return hasSamples()?'<div class="banner"><span>You are looking at sample invoices.</span><button class="btn sm" data-a="clear-samples">Clear sample data</button></div>':'';
}
function storageWarningHTML(){
  return storageBlocked?'<div class="err storage-warning" role="alert"><span>'+esc(storageMessage)+'</span><button class="btn sm" data-a="reset-storage">Reset saved invoice data</button></div>':'';
}

function chartHTML(base){
  var now=new Date(),months=[];
  for(var k=5;k>=0;k--){var d=new Date(now.getFullYear(),now.getMonth()-k,1);months.push({key:d.getFullYear()+'-'+pad(d.getMonth()+1),label:d.toLocaleDateString('en-US',{month:'short'}),inv:0,paid:0})}
  store.invoices.forEach(function(i){
    if(i.currency!==base||i.status==='draft')return;
    var amount=calc(i).total,issued=months.filter(function(x){return x.key===i.issue.slice(0,7)})[0];
    if(issued)issued.inv+=amount;
    if(Array.isArray(i.payments)&&i.payments.length)i.payments.forEach(function(payment){
      if(payment.voided)return;
      var paid=months.filter(function(x){return x.key===(payment.date||'').slice(0,7)})[0];
      if(paid)paid.paid+=+payment.amount||0;
    });
    else if(i.status==='paid'&&i.paidOn){
      var paid=months.filter(function(x){return x.key===i.paidOn.slice(0,7)})[0];
      if(paid)paid.paid+=amount;
    }
  });
  var max=Math.max.apply(null,months.map(function(m){return Math.max(m.inv,m.paid)}).concat([1]));
  var p=Math.pow(10,Math.floor(Math.log10(max))),nm=Math.ceil(max/p)*p;
  var W=560,H=230,L=46,T=12,B=28,pw=W-L-8,ph=H-T-B,gw=pw/6,bw=gw*.27;
  var y=function(v){return T+ph*(1-v/nm)};
  var out='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Invoiced and paid amounts for the last six months">';
  [0,nm/2,nm].forEach(function(v){out+='<line class="grid" x1="'+L+'" x2="'+(W-8)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text x="'+(L-6)+'" y="'+(y(v)+4)+'" text-anchor="end">'+compact(v,base)+'</text>'});
  months.forEach(function(m,i){
    var cx=L+gw*i+gw/2;
    out+='<rect class="b-inv" x="'+(cx-bw-2)+'" y="'+y(m.inv)+'" width="'+bw+'" height="'+Math.max(0,y(0)-y(m.inv))+'" rx="3"/>';
    out+='<rect class="b-paid" x="'+(cx+2)+'" y="'+y(m.paid)+'" width="'+bw+'" height="'+Math.max(0,y(0)-y(m.paid))+'" rx="3"/>';
    out+='<text x="'+cx+'" y="'+(H-8)+'" text-anchor="middle">'+m.label+'</text>';
  });
  return out+'</svg>';
}

function dashView(){
  var base=store.profile.currency||'INR',t=today(),ym=t.slice(0,7);
  var mine=store.invoices.filter(function(i){return i.currency===base}),other=store.invoices.length-mine.length;
  var out=0,od=0,odN=0,paidM=0,expensesM=store.expenses.filter(function(item){return item.currency===base&&item.date.slice(0,7)===ym}).reduce(function(sum,item){return sum+item.amount},0);
  mine.forEach(function(i){var s=statusOf(i),a=balance(i);
    if((s==='sent'||s==='overdue')&&a>0)out+=a; if(s==='overdue'&&a>0){od+=a;odN++}
    if(Array.isArray(i.payments)&&i.payments.length){
      i.payments.forEach(function(p){if(!p.voided&&(p.date||'').slice(0,7)===ym)paidM+=+p.amount||0});
    }else if(i.status==='paid'&&(i.paidOn||'').slice(0,7)===ym)paidM+=calc(i).total});
  var recent=store.invoices.slice().sort(function(a,b){return a.issue<b.issue?1:-1}).slice(0,6);
  var list=recent.length?recent.map(function(i){var s=statusOf(i);
    return '<button class="row" data-a="open" data-id="'+i.id+'"><span><span class="rn">'+esc(i.client.name||'No client')+'</span><small>'+esc(i.number)+' · '+dueNote(i)+'</small></span><span class="r"><span class="num" style="display:block;font-weight:600">'+money(calc(i).total,i.currency)+'</span>'+pill(s)+'</span></button>'}).join(''):
    '<div class="empty"><h3>No invoices yet</h3><p>Create your first one to see it here.</p></div>';
  var upcoming=mine.filter(function(i){return (statusOf(i)==='sent'||statusOf(i)==='overdue')&&balance(i)>0}).sort(function(a,b){return a.due.localeCompare(b.due)}).slice(0,5);
  var upcomingHTML=upcoming.length?upcoming.map(function(i){return '<div class="row"><span><b>'+esc(i.client.name||i.number)+'</b><small>'+esc(i.number)+' · '+dueNote(i)+'</small></span><b class="num">'+money(balance(i),base)+'</b></div>'}).join(''):'<p class="muted">No upcoming balances.</p>';
  var clientTotals={};
  mine.filter(function(i){return i.status!=='draft'}).forEach(function(i){var name=i.client.name||i.client.email||'Unknown client';clientTotals[name]=(clientTotals[name]||0)+calc(i).total});
  var topNames=Object.keys(clientTotals).sort(function(a,b){return clientTotals[b]-clientTotals[a]}).slice(0,5);
  var topHTML=topNames.length?topNames.map(function(name){return '<div class="row"><span>'+esc(name)+'</span><b class="num">'+money(clientTotals[name],base)+'</b></div>'}).join(''):'<p class="muted">Create invoices to see top clients.</p>';
  var activityHTML=store.activity.slice(0,5).map(function(item){return '<div class="row"><span>'+esc(item.description)+'</span><small>'+fmtDate((item.at||'').slice(0,10))+'</small></div>'}).join('')||'<p class="muted">Recent activity will appear here.</p>';
  var preferences=store.preferences||{},visible=preferences.visible||{},order=preferences.order||['stats','chart','recent','activity','upcoming','top-clients'];
  var pos=function(name){var index=order.indexOf(name);return index<0?99:index};
  return '<div class="page"><div class="page-h"><div><h1>Dashboard</h1><p class="muted">Business financial overview · '+base+'</p></div><div class="actions"><a class="btn" href="#reports">View reports</a><a class="btn primary" href="#new">New invoice</a></div></div>'+bannerHTML()+
    '<div class="dashboard-widgets"><section class="dashboard-widget dashboard-stats" data-widget="stats" style="order:'+pos('stats')+'"'+(visible.stats===false?' hidden':'')+'><div class="stats"><div class="card stat"><div class="lbl">Outstanding</div><div class="v num">'+money(out,base)+'</div></div>'+
    '<div class="card stat bad"><div class="lbl">Overdue ('+odN+')</div><div class="v num">'+money(od,base)+'</div></div>'+
    '<div class="card stat good"><div class="lbl">Payments received this month</div><div class="v num">'+money(paidM,base)+'</div></div>'+
    '<div class="card stat"><div class="lbl">Invoices</div><div class="v num">'+store.invoices.length+'</div></div>'+
    '<div class="card stat"><div class="lbl">Expenses this month</div><div class="v num">'+money(expensesM,base)+'</div></div>'+
    '<div class="card stat '+(paidM-expensesM>=0?'good':'bad')+'"><div class="lbl">Net income this month</div><div class="v num">'+money(paidM-expensesM,base)+'</div></div></div>'+
    (other?'<p class="muted" style="font-size:13px;margin:-4px 0 14px">Totals show '+base+' invoices. '+other+' in other currencies are not included.</p>':'')+'</section>'+
    '<section class="card dashboard-widget" data-widget="chart" style="order:'+pos('chart')+'"'+(visible.chart===false?' hidden':'')+'><h2 style="font-size:18px">Last six months</h2><div class="legend"><span><i style="background:var(--accent)"></i>Invoiced</span><span><i style="background:var(--good)"></i>Paid</span></div>'+chartHTML(base)+'</section>'+
    '<section class="card dashboard-widget" data-widget="recent" style="order:'+pos('recent')+'"'+(visible.recent===false?' hidden':'')+'><h2 style="font-size:18px;margin-bottom:6px">Recent invoices</h2><div class="list">'+list+'</div></section>'+
    '<section class="card dashboard-widget" data-widget="upcoming" style="order:'+pos('upcoming')+'"'+(visible.upcoming===false?' hidden':'')+'><h2 style="font-size:18px">Upcoming payments</h2><div class="list">'+upcomingHTML+'</div><a href="#payments">View payment ledger</a></section>'+
    '<section class="card dashboard-widget" data-widget="top-clients" style="order:'+pos('top-clients')+'"'+(visible['top-clients']===false?' hidden':'')+'><h2 style="font-size:18px">Top clients · '+base+'</h2><div class="list">'+topHTML+'</div></section>'+
    '<section class="card dashboard-widget" data-widget="activity" style="order:'+pos('activity')+'"'+(visible.activity===false?' hidden':'')+'><h2 style="font-size:18px">Recent activity</h2><div class="list">'+activityHTML+'</div><a href="#activity">View activity log</a></section></div></div>';
}

var filt={q:'',s:'all'};
function rowsHTML(){
  var q=filt.q.trim().toLowerCase();
  var rows=store.invoices.filter(function(i){
    if(filt.s!=='all'&&statusOf(i)!==filt.s)return false;
    return !q||(i.number+' '+i.client.name+' '+i.client.email).toLowerCase().indexOf(q)>-1;
  }).sort(function(a,b){return a.issue<b.issue?1:-1});
  if(!rows.length)return '<tr><td colspan="7"><div class="empty"><h3>'+(store.invoices.length?'No matching invoices':'No invoices yet')+'</h3><p>'+(store.invoices.length?'Try a different search or status.':'Create your first invoice to get started.')+'</p></div></td></tr>';
  return rows.map(function(i){return '<tr data-a="open" data-id="'+i.id+'"><td><b>'+esc(i.number)+'</b></td><td>'+esc(i.client.name||'-')+'</td><td class="num">'+fmtDate(i.issue)+'</td><td class="num">'+fmtDate(i.due)+'</td><td class="r num"><b>'+money(calc(i).total,i.currency)+'</b></td><td>'+pill(statusOf(i))+'</td><td class="r"><button class="btn sm" data-a="open" data-id="'+i.id+'">View</button></td></tr>'}).join('');
}
function invView(){
  return '<div class="page"><div class="page-h"><h1>Invoices</h1><a class="btn primary" href="#new">New invoice</a></div>'+bannerHTML()+
    '<div class="toolbar"><input id="q" type="search" placeholder="Search by number or client" aria-label="Search invoices" value="'+esc(filt.q)+'">'+
    '<select id="sf" aria-label="Filter by status">'+['all','draft','sent','overdue','paid'].map(function(s){return '<option value="'+s+'"'+(filt.s===s?' selected':'')+'>'+(s==='all'?'All statuses':LABEL[s])+'</option>'}).join('')+'</select></div>'+
    '<div class="tbl-wrap"><table><thead><tr><th>Number</th><th>Client</th><th>Issued</th><th>Due</th><th class="r">Amount</th><th>Status</th><th></th></tr></thead><tbody id="rows">'+rowsHTML()+'</tbody></table></div></div>';
}

function bizView(){
  var p=store.profile;
  function f(id,label,val,type){return '<div class="field"><label for="'+id+'">'+label+'</label><input id="'+id+'" data-p="'+id.slice(2)+'" type="'+(type||'text')+'" value="'+esc(val)+'"></div>'}
  return '<div class="page"><div class="page-h"><h1>Business</h1></div>'+
    '<p class="muted" style="margin:-8px 0 18px">These details appear on every invoice and set your defaults.</p><div class="stack" style="max-width:760px">'+
    '<div class="card"><h2>Your details</h2><div class="stack"><div class="grid2">'+f('b-name','Business name',p.name)+f('b-taxId','GSTIN / Tax ID',p.taxId)+'</div><div class="grid2">'+f('b-email','Email',p.email,'email')+f('b-phone','Phone',p.phone)+'</div>'+
    '<div class="field"><label for="b-address">Address</label><textarea id="b-address" data-p="address">'+esc(p.address)+'</textarea></div></div></div>'+
    '<div class="card"><h2>Defaults for new invoices</h2><div class="stack"><div class="grid3"><div class="field"><label for="b-currency">Currency</label><select id="b-currency" data-p="currency">'+CURS.map(function(c){return '<option'+(p.currency===c?' selected':'')+'>'+c+'</option>'}).join('')+'</select></div>'+
    f('b-tax','Tax rate (%)',p.tax,'number')+f('b-terms','Payment terms (days)',p.terms,'number')+'</div>'+f('b-prefix','Invoice number prefix',p.prefix)+
    '<div class="field"><label for="b-payment">Payment details</label><textarea id="b-payment" data-p="payment" placeholder="Bank account, IFSC, UPI ID, payment link">'+esc(p.payment)+'</textarea></div></div></div>'+
    '<div class="actions"><button class="btn primary" data-a="save-biz">Save business details</button></div></div></div>';
}

/* ---------- editor ---------- */
var draft=null,editingId=null,formErr='';
function newDraft(){
  var p=store.profile,t=today();
  return {id:uid(),number:nextNumber(),client:{name:'',email:'',address:''},issue:t,due:addDays(t,+p.terms),currency:p.currency||'INR',
    items:[{d:'',q:1,r:0}],discount:0,tax:+p.tax||0,notes:'',status:'draft',paidOn:'',sample:false};
}
function itemsHTML(){
  return draft.items.map(function(it,i){
    return '<div class="item"><input class="d" id="it-d-'+i+'" data-i="'+i+'" data-k="d" placeholder="Description" aria-label="Description" value="'+esc(it.d)+'">'+
      '<input id="it-q-'+i+'" data-i="'+i+'" data-k="q" type="number" min="0" step="any" aria-label="Quantity" value="'+esc(it.q)+'">'+
      '<input id="it-r-'+i+'" data-i="'+i+'" data-k="r" type="number" min="0" step="any" aria-label="Rate" value="'+esc(it.r)+'">'+
      '<div class="amt num" id="it-a-'+i+'">'+money(r2((+it.q||0)*(+it.r||0)),draft.currency)+'</div>'+
      '<button class="x" data-a="del-item" data-i="'+i+'" aria-label="Remove line">&times;</button></div>';
  }).join('');
}
function editorView(){
  if(!draft)draft=newDraft();
  var d=draft,c=calc(d);
  return '<div class="page"><div class="page-h"><h1>'+(editingId?'Edit invoice':'New invoice')+'</h1><a class="btn" href="#invoices">Cancel</a></div>'+
    '<div id="formerr">'+(formErr?'<div class="err" role="alert">'+esc(formErr)+'</div>':'')+'</div>'+
    '<div class="editor"><div class="stack">'+
    '<div class="card"><h2>Client</h2><div class="stack">'+(store.clients.length?'<div class="field"><label for="f-client-select">Use saved client</label><select id="f-client-select" data-client-select><option value="">Choose a client...</option>'+store.clients.map(function(client){return '<option value="'+esc(client.id)+'"'+((d.clientId===client.id)?' selected':'')+'>'+esc(client.name+(client.company?' · '+client.company:''))+'</option>'}).join('')+'</select></div>':'')+'<div class="grid2"><div class="field"><label for="c-name">Client name</label><input id="c-name" data-f="client.name" value="'+esc(d.client.name)+'"></div>'+
    '<div class="field"><label for="c-email">Client email</label><input id="c-email" type="email" data-f="client.email" value="'+esc(d.client.email)+'"></div></div>'+
    '<div class="field"><label for="c-address">Billing address</label><textarea id="c-address" data-f="client.address">'+esc(d.client.address)+'</textarea></div></div></div>'+
    '<div class="card"><h2>Invoice details</h2><div class="grid3"><div class="field"><label for="f-number">Invoice number</label><input id="f-number" data-f="number" value="'+esc(d.number)+'"></div>'+
    '<div class="field"><label for="f-issue">Issue date</label><input id="f-issue" type="date" data-f="issue" value="'+d.issue+'"></div>'+
    '<div class="field"><label for="f-due">Due date</label><input id="f-due" type="date" data-f="due" value="'+d.due+'"></div></div></div>'+
    '<div class="card"><h2>Line items</h2><div class="items-h"><span>Description</span><span>Qty</span><span>Rate</span><span style="text-align:right">Amount</span><span></span></div><div id="items">'+itemsHTML()+'</div>'+
    '<button class="btn sm" data-a="add-item" style="margin-top:4px">Add line</button></div>'+
    '<div class="card"><h2>Tax, currency and notes</h2><div class="stack"><div class="grid3"><div class="field"><label for="f-discount">Discount (%)</label><input id="f-discount" type="number" min="0" max="100" step="any" data-f="discount" value="'+esc(d.discount)+'"></div>'+
    '<div class="field"><label for="f-tax">Tax rate (%)</label><input id="f-tax" type="number" min="0" step="any" data-f="tax" value="'+esc(d.tax)+'"></div>'+
    '<div class="field"><label for="f-currency">Currency</label><select id="f-currency" data-f="currency">'+CURS.map(function(x){return '<option'+(d.currency===x?' selected':'')+'>'+x+'</option>'}).join('')+'</select></div></div>'+
    '<div class="field"><label for="f-notes">Notes for the client</label><textarea id="f-notes" data-f="notes" placeholder="Thank you for your business.">'+esc(d.notes)+'</textarea></div></div></div></div>'+
    '<aside class="card sum"><h2>Summary</h2><dl class="num"><dt>Subtotal</dt><dd id="t-sub">'+money(c.sub,d.currency)+'</dd><dt>Discount</dt><dd id="t-disc">-'+money(c.disc,d.currency)+'</dd><dt>Tax</dt><dd id="t-tax">'+money(c.tax,d.currency)+'</dd></dl>'+
    '<div class="tot num" style="display:flex;justify-content:space-between;gap:12px;margin-top:12px"><span>Total</span><span id="t-total">'+money(c.total,d.currency)+'</span></div>'+
    '<div class="actions" style="margin-top:16px">'+
    (editingId?'<button class="btn primary" data-a="save" data-st="keep">Save changes</button>':'<button class="btn primary" data-a="save" data-st="sent">Save and mark sent</button><button class="btn" data-a="save" data-st="draft">Save draft</button>')+
    '</div></aside></div></div>';
}
function updateTotals(){
  var c=calc(draft),cur=draft.currency;
  $('#t-sub').textContent=money(c.sub,cur);$('#t-disc').textContent='-'+money(c.disc,cur);$('#t-tax').textContent=money(c.tax,cur);$('#t-total').textContent=money(c.total,cur);
  draft.items.forEach(function(it,i){var e=$('#it-a-'+i);if(e)e.textContent=money(r2((+it.q||0)*(+it.r||0)),cur)});
}
function setPath(o,path,v){var p=path.split('.');for(var i=0;i<p.length-1;i++)o=o[p[i]];o[p[p.length-1]]=v}
function saveDraft(st){
  var d=draft,err='',validItems=[];
  if(!d.client.name.trim())err='Enter the client name.';
  else if(d.client.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.client.email.trim()))err='Enter a valid client email address.';
  else if(!d.number.trim())err='Enter an invoice number.';
  else if(store.invoices.some(function(i){return i.number.toLowerCase()===d.number.trim().toLowerCase()&&i.id!==d.id}))err='Invoice number '+d.number+' is already used. Choose another.';
  else if(!validDate(d.issue)||!validDate(d.due))err='Enter a valid issue date and due date.';
  else if(d.due<d.issue)err='The due date is before the issue date.';
  else if(!isFinite(+d.discount)||+d.discount<0||+d.discount>100)err='Discount must be between 0 and 100 percent.';
  else if(!isFinite(+d.tax)||+d.tax<0)err='Tax rate must be a non-negative number.';
  else if(CURS.indexOf(d.currency)===-1)err='Choose a supported currency.';
  if(!err)d.items.forEach(function(item){
    var description=String(item.d||'').trim(),quantity=+item.q,rate=+item.r;
    if(!description&&rate===0)return;
    if(!description){err='Add a description to each non-empty line item.';return}
    if(!isFinite(quantity)||quantity<=0||!isFinite(rate)||rate<0){err='Each line needs a positive quantity and a non-negative rate.';return}
    validItems.push({d:description,q:quantity,r:rate});
  });
  if(!err&&!validItems.some(function(item){return item.q*item.r>0}))err='Add at least one line with a description and an amount above zero.';
  if(err){formErr=err;$('#formerr').innerHTML='<div class="err" role="alert">'+esc(err)+'</div>';window.scrollTo(0,0);return}
  formErr='';
  d.number=d.number.trim();d.client.name=d.client.name.trim();d.client.email=d.client.email.trim();
  d.items=validItems;
  d.discount=+d.discount||0;d.tax=+d.tax||0;
  if(st==='sent'||st==='draft')d.status=st;
  var previousInvoices=store.invoices.slice(),previousActivity=store.activity.slice();
  var idx=store.invoices.map(function(i){return i.id}).indexOf(d.id);
  if(idx>-1)store.invoices[idx]=d;else store.invoices.push(d);
  recordActivity(editingId?'invoice-edited':'invoice-created',(editingId?'Edited ':'Created ')+d.number,d.id);
  if(!persist()){store.invoices=previousInvoices;store.activity=previousActivity;return}
  if(!editingId&&window.InvoiceProApp)window.InvoiceProApp.notify('invoice','Invoice created',d.number+' for '+d.client.name,d.id);
  toast(editingId?'Changes saved':st==='sent'?'Invoice '+d.number+' saved as sent':'Draft saved');
  draft=null;editingId=null;location.hash='invoices';
}

/* ---------- drawer ---------- */
var openId=null,confirmDel=false;
function summaryText(i){var c=calc(i);return 'Invoice '+i.number+' for '+i.client.name+'\nAmount: '+money(c.total,i.currency)+'\nIssued: '+fmtDate(i.issue)+'\nDue: '+fmtDate(i.due)+(store.profile.payment?'\n\nPayment details:\n'+store.profile.payment:'')}
function drawerHTML(i){
  var s=statusOf(i),b='';
  if(s==='draft')b+='<button class="btn primary" data-a="status" data-s="sent">Mark as sent</button>';
  if(s==='sent'||s==='overdue')b+='<button class="btn good" data-a="status" data-s="paid">Mark as paid</button>';
  if(s==='paid')b+='<button class="btn" data-a="status" data-s="sent">Reopen</button>';
  if(s!=='draft')b+='<button class="btn" data-a="status" data-s="draft">Mark as draft</button>';
  if(s!=='draft')b+='<button class="btn good" data-a="payments">Record payment</button>';
  b+='<button class="btn" data-a="edit">Edit</button><button class="btn" data-a="dup">Duplicate</button><button class="btn" data-a="copy">Copy summary</button><button class="btn" data-a="print">Print / Save PDF</button>';
  b+=confirmDel?'<button class="btn danger" data-a="del-yes">Confirm delete</button><button class="btn" data-a="del-no">Keep</button>':'<button class="btn danger" data-a="del">Delete</button>';
  return '<div class="scrim" data-a="close-bg"><div class="panel" role="dialog" aria-modal="true" aria-label="Invoice '+esc(i.number)+'"><div class="panel-h"><h2>'+esc(i.number)+'</h2><button class="btn sm" data-a="close" id="closebtn">Close</button></div>'+
    '<div class="actions" style="margin:0 0 14px">'+b+'</div><div class="note"><b>Payment status</b><br>Received: '+money(paidAmount(i),i.currency)+' · Remaining: '+money(balance(i),i.currency)+
    ((i.payments||[]).length?'<br><br><b>Payment history</b><br>'+i.payments.map(function(payment){return fmtDate(payment.date)+' · '+money(payment.amount,i.currency)+' · '+esc(payment.method)+(payment.voided?' · Reopened':'' )}).join('<br>'):'')+
    '</div><div id="copyhold"></div>'+docHTML(i,store.profile)+'</div></div>';
}
function showDrawer(id){
  var i=store.invoices.filter(function(x){return x.id===id})[0];if(!i)return closeDrawer();
  openId=id;var d=$('#drawer');d.innerHTML=drawerHTML(i);d.hidden=false;document.body.style.overflow='hidden';var cb=$('#closebtn');if(cb)cb.focus();
}
function closeDrawer(){openId=null;confirmDel=false;var d=$('#drawer');d.hidden=true;d.innerHTML='';document.body.style.overflow=''}
function current(){return store.invoices.filter(function(x){return x.id===openId})[0]}

/* ---------- router ---------- */
var ROUTES={home:homeView,dashboard:dashView,invoices:invView,business:bizView,'new':editorView};
function render(){
  var defaultRoute=store.preferences&&store.preferences.defaultView==='invoices'?'invoices':'dashboard';
  var r=(location.hash||('#'+defaultRoute)).slice(1);if(!ROUTES[r])r='home';
  if(r!=='new'&&draft&&!editingId){draft=null}
  if(r==='new'&&!draft&&editingId){var e=store.invoices.filter(function(x){return x.id===editingId})[0];if(e)draft=JSON.parse(JSON.stringify(e));else editingId=null}
  $('#view').innerHTML=storageWarningHTML()+ROUTES[r]();
  document.querySelectorAll('#nav a').forEach(function(a){if(a.getAttribute('data-r')===r)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  document.title='InvoicePro';
}
window.addEventListener('hashchange',function(){closeDrawer();if((location.hash||'')!=='#new'){editingId=null;draft=null}formErr='';render();window.scrollTo(0,0)});

/* ---------- events ---------- */
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-a]');if(!t)return;
  var a=t.getAttribute('data-a');
  if(a==='reset-storage'){
    if(!window.confirm('This removes the unreadable local invoice data and starts with sample invoices. Continue?'))return;
    try{localStorage.removeItem(KEY)}catch(err){toast('Browser storage is unavailable; saved data could not be reset.');return}
    storageBlocked=false;storageMessage='';store=seed();
    if(!persist())return;
    render();toast('Saved invoice data reset');return
  }
  if(a==='close-bg'){if(e.target===t)closeDrawer();return}
  if(a==='open'){showDrawer(t.getAttribute('data-id'));return}
  if(a==='close'){closeDrawer();return}
  if(a==='payments'){closeDrawer();location.hash='payments';return}
  if(a==='clear-samples'){
    var beforeSamples=store.invoices;
    store.invoices=store.invoices.filter(function(i){return !i.sample});
    if(!persist()){store.invoices=beforeSamples;return}
    render();toast('Sample data cleared');return
  }
  if(a==='save-biz'){
    var profile=store.profile,previousProfile=JSON.parse(JSON.stringify(profile)),previousActivity=store.activity.slice();
    if(!profile.name.trim()){toast('Enter your business name.');return}
    if(profile.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())){toast('Enter a valid business email address.');return}
    if(!isFinite(+profile.tax)||+profile.tax<0||!isFinite(+profile.terms)||+profile.terms<0){toast('Tax and payment terms must be non-negative numbers.');return}
    if(!profile.prefix.trim()){toast('Enter an invoice number prefix.');return}
    recordActivity('business-updated','Business settings updated');
    if(persist())toast('Business details saved');else{store.profile=previousProfile;store.activity=previousActivity}
    return
  }
  if(a==='add-item'){draft.items.push({d:'',q:1,r:0});$('#items').innerHTML=itemsHTML();var n=$('#it-d-'+(draft.items.length-1));if(n)n.focus();return}
  if(a==='del-item'){if(draft.items.length>1){draft.items.splice(+t.getAttribute('data-i'),1);$('#items').innerHTML=itemsHTML();updateTotals()}return}
  if(a==='save'){saveDraft(t.getAttribute('data-st'));return}
  var inv=current();if(!inv)return;
  if(a==='status'){
    var st=t.getAttribute('data-s'),oldStatus=inv.status,oldPaidOn=inv.paidOn,oldPayments=inv.payments.slice(),previousActivity=store.activity.slice();
    if(st==='paid'&&balance(inv)>0)inv.payments.push({id:uid(),amount:balance(inv),date:today(),method:'Other',reference:'',note:'Marked paid from invoice actions'});
    if(st==='sent'&&oldStatus==='paid')inv.payments.forEach(function(payment){payment.voided=true});
    inv.status=st;inv.paidOn=st==='paid'?today():'';
    recordActivity(st==='paid'?'invoice-paid':'invoice-status','Invoice '+inv.number+' marked '+st,inv.id);
    if(!persist()){inv.status=oldStatus;inv.paidOn=oldPaidOn;inv.payments=oldPayments;store.activity=previousActivity;return}
    toast(st==='paid'?'Marked as paid':st==='sent'?'Marked as sent':'Updated');showDrawer(inv.id);render();return
  }
  if(a==='edit'){editingId=inv.id;draft=JSON.parse(JSON.stringify(inv));closeDrawer();if(location.hash==='#new')render();else location.hash='new';return}
  if(a==='dup'){var c=JSON.parse(JSON.stringify(inv));c.id=uid();c.number=nextNumber();c.status='draft';c.paidOn='';c.sample=false;c.issue=today();c.due=addDays(c.issue,+store.profile.terms);
    editingId=null;draft=c;closeDrawer();if(location.hash==='#new')render();else location.hash='new';toast('Duplicated. Review and save.');return}
  if(a==='copy'){var txt=summaryText(inv);
    var fallback=function(){$('#copyhold').innerHTML='<div class="copybox field"><label for="copyta">Select and copy</label><textarea id="copyta" readonly rows="6">'+esc(txt)+'</textarea></div>';var ta=$('#copyta');ta.focus();ta.select()};
    try{navigator.clipboard.writeText(txt).then(function(){toast('Summary copied')},fallback)}catch(err){fallback()}return}
  if(a==='print'){
    document.body.classList.add('printing-invoice');
    window.addEventListener('afterprint',function(){document.body.classList.remove('printing-invoice')},{once:true});
    window.print();return
  }
  if(a==='del'){confirmDel=true;showDrawer(inv.id);return}
  if(a==='del-no'){confirmDel=false;showDrawer(inv.id);return}
  if(a==='del-yes'){
    var beforeDelete=store.invoices,previousActivity=store.activity.slice();
    store.invoices=store.invoices.filter(function(x){return x.id!==inv.id});
    recordActivity('invoice-deleted','Deleted invoice '+inv.number,inv.id);
    if(!persist()){store.invoices=beforeDelete;store.activity=previousActivity;return}
    closeDrawer();render();toast('Invoice deleted');return
  }
});
document.addEventListener('input',function(e){
  var t=e.target;
  if(t.id==='q'){filt.q=t.value;$('#rows').innerHTML=rowsHTML();return}
  if(t.hasAttribute('data-p')){
    var k=t.getAttribute('data-p'),value=t.type==='number'?(t.value===''?0:+t.value):t.value;
    if((k==='tax'||k==='terms')&&(!isFinite(value)||value<0)){t.value=store.profile[k];toast('Tax and payment terms cannot be negative.');return}
    store.profile[k]=value;persist();return
  }
  if(!draft)return;
  if(t.hasAttribute('data-k')){var it=draft.items[+t.getAttribute('data-i')];if(it){var kk=t.getAttribute('data-k');it[kk]=kk==='d'?t.value:(t.value===''?0:+t.value);updateTotals()}return}
  if(t.hasAttribute('data-f')){var f=t.getAttribute('data-f'),v=t.type==='number'?(t.value===''?0:+t.value):t.value;setPath(draft,f,v);
    if(f.indexOf('client.')===0)draft.clientId='';
    if(f==='issue'&&v&&draft.due<v){draft.due=addDays(v,+store.profile.terms);$('#f-due').value=draft.due}
    updateTotals()}
});
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.hasAttribute('data-client-select')&&draft){
    var client=store.clients.filter(function(item){return item.id===t.value})[0];
    if(client){draft.clientId=client.id;draft.client={name:client.name,email:client.email||'',address:client.address||''};
      $('#c-name').value=draft.client.name;$('#c-email').value=draft.client.email;$('#c-address').value=draft.client.address}
    return
  }
  if(t.id==='sf'){filt.s=t.value;$('#rows').innerHTML=rowsHTML();return}
  if(t.hasAttribute('data-p')){var k=t.getAttribute('data-p');store.profile[k]=t.type==='number'?(+t.value||0):t.value;persist();return}
  if(draft&&t.getAttribute('data-f')==='currency'){draft.currency=t.value;updateTotals()}
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&openId)closeDrawer();
  if((e.key==='Enter'||e.key===' ')&&e.target.tagName==='TR'&&e.target.getAttribute('data-a')==='open'){e.preventDefault();showDrawer(e.target.getAttribute('data-id'))}
});

window.InvoiceProApp={
  getStore:function(){return store},
  save:persist,
  render:render,
  toast:toast,
  calc:calc,
  money:money,
  formatDate:fmtDate,
  today:today,
  addDays:addDays,
  uid:uid,
  escape:esc,
  statusOf:statusOf,
  invoicePreview:function(invoice){return docHTML(invoice,store.profile)},
  paidAmount:paidAmount,
  balance:balance,
  recordActivity:recordActivity,
  notify:function(type,title,message,relatedId){
    store.notifications.unshift({id:uid(),type:type,title:title,message:message,relatedId:relatedId||'',at:new Date().toISOString(),read:false});
    if(store.notifications.length>300)store.notifications.length=300;
    persist();
  },
  registerRoute:function(name,view){ROUTES[name]=view;render()},
  registerRoutes:function(routes){Object.keys(routes).forEach(function(name){ROUTES[name]=routes[name]});render()},
  saveInvoice:function(invoice){
    if(store.invoices.some(function(item){return item.number.toLowerCase()===invoice.number.toLowerCase()}))throw new Error('Invoice number is already in use.');
    store.invoices.push(invoice);recordActivity('invoice-created','Created '+invoice.number,invoice.id);
    if(!persist()){store.invoices.pop();throw new Error('Invoice could not be saved to browser storage.')}
  }
};
render();
})();
