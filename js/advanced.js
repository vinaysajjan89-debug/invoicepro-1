(function(){
'use strict';
var app=window.InvoiceProApp;
if(!app)return;
var store=app.getStore(),$=function(s,r){return (r||document).querySelector(s)};
var esc=app.escape,fmt=app.formatDate,uid=app.uid,money=app.money;
var clientEdit='',expenseEdit='',paymentInvoice='',reminderDraft='',scheduleReminderId='';
var clientQuery='',expenseQuery='',expenseCategory='all',reportPeriod='month',reportCurrency='all';
var receiptData='',logoData='';
var templates={modern:'Modern',classic:'Classic',minimal:'Minimal',professional:'Professional business'};
var CATS=['Advertising','Bank fees','Equipment','Meals','Office','Rent','Software','Travel','Utilities','Other'];
function dateOnly(value){return String(value||'').slice(0,10)}
function clone(value){return JSON.parse(JSON.stringify(value))}
function persist(message){if(app.save()){if(message)app.toast(message);return true}return false}
function transaction(change,message){
  var previous=clone(store);
  change();
  if(!app.save()){
    Object.keys(store).forEach(function(key){delete store[key]});
    Object.keys(previous).forEach(function(key){store[key]=previous[key]});
    return false;
  }
  if(message)app.toast(message);
  return true;
}
function field(id,label,value,type,attrs){
  return '<div class="field"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+(type||'text')+'" value="'+esc(value||'')+'" '+(attrs||'')+'></div>';
}
function selectField(id,label,options,value){
  return '<div class="field"><label for="'+id+'">'+label+'</label><select id="'+id+'">'+options.map(function(option){
    return '<option value="'+esc(option.value)+'"'+(option.value===value?' selected':'')+'>'+esc(option.label)+'</option>';
  }).join('')+'</select></div>';
}
function textField(id,label,value,placeholder){
  return '<div class="field"><label for="'+id+'">'+label+'</label><textarea id="'+id+'" placeholder="'+esc(placeholder||'')+'">'+esc(value||'')+'</textarea></div>';
}
function empty(title,description){return '<div class="empty"><h3>'+esc(title)+'</h3><p>'+esc(description)+'</p></div>'}
function calcPaid(invoice){return app.paidAmount(invoice)}
function status(invoice){return app.statusOf(invoice)}
function findInvoice(id){return store.invoices.filter(function(item){return item.id===id})[0]}
function addActivity(type,description,id){app.recordActivity(type,description,id)}
function addNotice(type,title,message,id){app.notify(type,title,message,id);updateNotificationCount()}
function updateNotificationCount(){
  var badge=$('#notification-count'),unread=store.notifications.filter(function(item){return !item.read}).length;
  if(badge){badge.textContent=unread>99?'99+':String(unread);badge.hidden=!unread}
}
function notifyUpcoming(){
  store.invoices.forEach(function(invoice){
    var st=status(invoice),balance=app.balance(invoice),days=invoice.due?Math.round((new Date(invoice.due+'T12:00:00')-new Date(app.today()+'T12:00:00'))/864e5):10000;
    if(balance<=0||st==='draft')return;
    var kind=st==='overdue'?'overdue':days<=7?'due-soon':'';
    if(!kind)return;
    var key=kind+':'+invoice.id+':'+invoice.due;
    if(!store.notifications.some(function(item){return item.key===key})){
      store.notifications.unshift({id:uid(),key:key,type:kind,title:kind==='overdue'?'Overdue invoice':'Upcoming due date',
        message:invoice.number+' for '+invoice.client.name+' · '+fmt(invoice.due),relatedId:invoice.id,at:new Date().toISOString(),read:false});
    }
  });
  store.recurring.forEach(function(item){
    if(item.active&&item.nextDate&&item.nextDate<=app.today()&&!store.notifications.some(function(n){return n.key==='recurring:'+item.id+':'+item.nextDate})){
      store.notifications.unshift({id:uid(),key:'recurring:'+item.id+':'+item.nextDate,type:'recurring',title:'Recurring invoice due',
        message:'A recurring invoice is ready to generate.',relatedId:item.id,at:new Date().toISOString(),read:false});
    }
  });
  store.reminders.forEach(function(item){
    if(item.status==='scheduled'&&item.scheduledFor<=app.today()){
      item.status='due';
      if(!store.notifications.some(function(n){return n.key==='reminder:'+item.id})){
        store.notifications.unshift({id:uid(),key:'reminder:'+item.id,type:'reminder',title:'Scheduled reminder ready',
          message:'Reminder for '+item.invoiceNumber+' is ready to copy or send.',relatedId:item.invoiceId,at:new Date().toISOString(),read:false});
      }
    }
  });
  if(app.save())updateNotificationCount();
}
function clientTotals(client){
  var records=store.invoices.filter(function(invoice){return invoice.clientId===client.id||
    (client.email&&invoice.client.email.toLowerCase()===client.email.toLowerCase())});
  return records.reduce(function(total,invoice){
    total.invoiced+=app.calc(invoice).total;total.received+=calcPaid(invoice);total.balance+=app.balance(invoice);return total;
  },{invoiced:0,received:0,balance:0,count:records.length});
}
function clientCurrencyTotals(client){
  var totals={};
  store.invoices.filter(function(invoice){return invoice.clientId===client.id||
    (client.email&&invoice.client.email.toLowerCase()===client.email.toLowerCase())}).forEach(function(invoice){
    var code=invoice.currency,item=totals[code]||(totals[code]={invoiced:0,received:0,balance:0});
    item.invoiced+=app.calc(invoice).total;item.received+=calcPaid(invoice);item.balance+=app.balance(invoice);
  });
  return Object.keys(totals).sort().map(function(code){var item=totals[code];return code+' '+money(item.invoiced,code)+' invoiced · '+money(item.received,code)+' received · '+money(item.balance,code)+' due'}).join('<br>');
}
function clientsView(){
  var q=clientQuery.toLowerCase();
  var clients=store.clients.filter(function(client){return !q||(client.name+' '+client.company+' '+client.email+' '+client.phone).toLowerCase().indexOf(q)>-1});
  var editing=clientEdit?store.clients.filter(function(client){return client.id===clientEdit})[0]:null;
  var form='<section class="card"><h2>'+(editing?'Edit client':'Add client')+'</h2><form id="client-form" class="stack"><div class="grid2">'+
    field('cl-name','Client name',editing&&editing.name,'text','required')+field('cl-company','Company name',editing&&editing.company)+
    field('cl-email','Email address',editing&&editing.email,'email')+field('cl-phone','Phone number',editing&&editing.phone)+
    field('cl-tax','GSTIN / Tax ID',editing&&editing.taxId)+'</div>'+textField('cl-address','Billing address',editing&&editing.address)+
    textField('cl-notes','Client notes',editing&&editing.notes)+
    '<div class="actions"><button class="btn primary" type="submit">'+(editing?'Save client':'Add client')+'</button>'+
    (editing?'<button class="btn" type="button" data-adv="cancel-client">Cancel</button>':'')+'</div></form></section>';
  var rows=clients.map(function(client){
    var totals=clientTotals(client),byCurrency=clientCurrencyTotals(client);
    return '<tr><td><b>'+esc(client.name)+'</b><small class="table-sub">'+esc(client.company||'')+'</small></td><td>'+esc(client.email||'-')+'</td>'+
      '<td>'+totals.count+'</td><td class="num">'+(byCurrency||'-')+'</td><td class="r"><button class="btn sm" data-adv="view-client" data-id="'+esc(client.id)+'">History</button> '+
      '<button class="btn sm" data-adv="edit-client" data-id="'+esc(client.id)+'">Edit</button> <button class="btn sm danger" data-adv="delete-client" data-id="'+esc(client.id)+'">Delete</button></td></tr>';
  }).join('');
  var selected=store.clients.filter(function(client){return client.id===reminderDraft})[0];
  var history=selected?'<section class="card"><div class="page-h"><h2>'+esc(selected.name)+' · Invoice history</h2><button class="btn sm" data-adv="close-client-history">Close</button></div>'+
    '<p class="muted">'+esc(selected.notes||'No client notes.')+'</p><div class="tbl-wrap"><table><thead><tr><th>Invoice</th><th>Issued</th><th>Status</th><th class="r">Invoiced</th><th class="r">Balance</th></tr></thead><tbody>'+
    store.invoices.filter(function(invoice){return invoice.clientId===selected.id||(selected.email&&invoice.client.email.toLowerCase()===selected.email.toLowerCase())})
      .map(function(invoice){return '<tr><td>'+esc(invoice.number)+'</td><td>'+fmt(invoice.issue)+'</td><td>'+esc(status(invoice))+'</td><td class="r num">'+money(app.calc(invoice).total,invoice.currency)+'</td><td class="r num">'+money(app.balance(invoice),invoice.currency)+'</td></tr>'}).join('')+'</tbody></table></div></section>':'';
  return '<div class="page"><div class="page-h"><div><h1>Clients</h1><p class="muted">Client records, notes, balances and invoice history.</p></div></div>'+
    form+history+'<section class="card"><div class="toolbar"><input id="client-search" type="search" aria-label="Search clients" placeholder="Search clients" value="'+esc(clientQuery)+'">'+
    '<button class="btn sm" data-adv="export-clients">Export clients CSV</button></div><div class="tbl-wrap"><table><thead><tr><th>Client</th><th>Email</th><th>Invoices</th><th>Totals by currency</th><th></th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="6">'+empty('No clients found','Add a client or change the search.')+'</td></tr>')+'</tbody></table></div></section></div>';
}
function expenseView(){
  var editing=expenseEdit?store.expenses.filter(function(item){return item.id===expenseEdit})[0]:null;
  var q=expenseQuery.toLowerCase(),items=store.expenses.filter(function(item){
    return (expenseCategory==='all'||item.category===expenseCategory)&&(!q||(item.vendor+' '+item.description+' '+item.category).toLowerCase().indexOf(q)>-1);
  }).sort(function(a,b){return b.date.localeCompare(a.date)});
  var month=app.today().slice(0,7),sum=store.expenses.filter(function(item){return item.date.slice(0,7)===month}).reduce(function(total,item){return total+item.amount},0);
  var categories=CATS.map(function(category){return Array.from(new Set(store.expenses.filter(function(item){return item.category===category}).map(function(item){return item.currency}))).map(function(currency){
    var amount=store.expenses.filter(function(item){return item.category===category&&item.currency===currency}).reduce(function(total,item){return total+item.amount},0);
    return '<span class="category-chip">'+esc(category)+' · '+money(amount,currency)+'</span>';
  }).join('')}).join('');
  var form='<section class="card"><h2>'+(editing?'Edit expense':'Add expense')+'</h2><form id="expense-form" class="stack"><div class="grid3">'+
    field('ex-vendor','Vendor',editing&&editing.vendor,'text','required')+selectField('ex-category','Category',CATS.map(function(x){return {value:x,label:x}}),editing?editing.category:'Other')+
    field('ex-date','Expense date',editing&&editing.date||app.today(),'date','required')+field('ex-amount','Amount',editing&&editing.amount,'number','min="0.01" step="0.01" required')+
    selectField('ex-method','Payment method',['Cash','Bank transfer','Card','UPI','Cheque','Other'].map(function(x){return {value:x,label:x}}),editing?editing.method:'Bank transfer')+
    field('ex-currency','Currency',editing&&editing.currency||store.profile.currency,'text','readonly')+'</div>'+
    textField('ex-description','Description',editing&&editing.description)+
    '<div class="field"><label for="ex-receipt">Receipt attachment (optional, max 1 MB)</label><input id="ex-receipt" type="file" accept="image/*,application/pdf"><small id="receipt-label" class="muted">'+esc(editing&&editing.receiptName||'No receipt attached')+'</small></div>'+
    '<div class="actions"><button class="btn primary" type="submit">'+(editing?'Save expense':'Add expense')+'</button>'+(editing?'<button class="btn" type="button" data-adv="cancel-expense">Cancel</button>':'')+'</div></form></section>';
  var rows=items.map(function(item){return '<tr><td>'+fmt(item.date)+'</td><td><b>'+esc(item.vendor)+'</b><small class="table-sub">'+esc(item.description||'')+'</small></td><td>'+esc(item.category)+'</td><td>'+esc(item.method)+'</td>'+
    '<td class="r num">'+money(item.amount,item.currency)+'</td><td>'+(item.receipt?'<a href="'+esc(item.receipt)+'" target="_blank" rel="noopener">Receipt</a>':'-')+'</td><td class="r"><button class="btn sm" data-adv="edit-expense" data-id="'+esc(item.id)+'">Edit</button> <button class="btn sm danger" data-adv="delete-expense" data-id="'+esc(item.id)+'">Delete</button></td></tr>'}).join('');
  return '<div class="page"><div class="page-h"><div><h1>Expenses</h1><p class="muted">Track business expenses and receipts.</p></div><div class="card stat"><div class="lbl">This month</div><div class="v num">'+money(sum,store.profile.currency)+'</div></div></div>'+
    form+'<section class="card"><div class="toolbar"><input id="expense-search" type="search" placeholder="Search expenses" aria-label="Search expenses" value="'+esc(expenseQuery)+'">'+
    '<select id="expense-category" aria-label="Filter expense category"><option value="all">All categories</option>'+CATS.map(function(c){return '<option'+(expenseCategory===c?' selected':'')+'>'+esc(c)+'</option>'}).join('')+'</select>'+
    '<button class="btn sm" data-adv="export-expenses">Export expenses CSV</button></div><div class="category-list">'+(categories||'<span class="muted">Category totals appear as you add expenses.</span>')+'</div>'+
    '<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Vendor / description</th><th>Category</th><th>Payment method</th><th class="r">Amount</th><th>Receipt</th><th></th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="7">'+empty('No expenses yet','Add an expense to start tracking costs.')+'</td></tr>')+'</tbody></table></div></section></div>';
}
function itemCurrency(){return store.profile.currency||'INR'}
function paymentsView(){
  var invoices=store.invoices.filter(function(invoice){return app.balance(invoice)>0||invoice.payments&&invoice.payments.length});
  var chosen=findInvoice(paymentInvoice);
  var form=chosen?'<section class="card"><h2>Record payment · '+esc(chosen.number)+'</h2><p class="muted">Remaining balance: '+money(app.balance(chosen),chosen.currency)+'. Online payments are not processed by this demo.</p>'+
    '<form id="payment-form" class="stack"><div class="grid3">'+field('pm-amount','Amount received','', 'number','min="0.01" step="0.01" required')+
    field('pm-date','Payment date',app.today(),'date','required')+selectField('pm-method','Payment method',['Bank transfer','Cash','Card','UPI','Cheque','Other'].map(function(x){return {value:x,label:x}}),'Bank transfer')+
    '</div>'+field('pm-reference','Transaction reference')+textField('pm-note','Confirmation details')+
    '<div class="actions"><button class="btn primary" type="submit">Save payment</button><button class="btn" type="button" data-adv="cancel-payment">Cancel</button></div></form></section>':'';
  var rows=invoices.map(function(invoice){
    var history=(invoice.payments||[]).map(function(payment){return fmt(payment.date)+' · '+money(payment.amount,invoice.currency)+' · '+esc(payment.method)+(payment.reference?' · '+esc(payment.reference):'')+(payment.note?' · '+esc(payment.note):'')+(payment.voided?' · Reopened':'')}).join('<br>');
    return '<tr><td><b>'+esc(invoice.number)+'</b><small class="table-sub">'+esc(invoice.client.name)+'</small></td><td>'+esc(status(invoice))+'</td><td class="r num">'+money(app.calc(invoice).total,invoice.currency)+'</td>'+
      '<td class="r num">'+money(calcPaid(invoice),invoice.currency)+'</td><td class="r num"><b>'+money(app.balance(invoice),invoice.currency)+'</b></td><td>'+ (history||'<span class="muted">No payments</span>')+
      '</td><td class="r">'+(app.balance(invoice)>0?'<button class="btn sm primary" data-adv="record-payment" data-id="'+esc(invoice.id)+'">Record payment</button>':'')+'</td></tr>';
  }).join('');
  return '<div class="page"><div class="page-h"><div><h1>Payments</h1><p class="muted">Record partial and full payments against invoices.</p></div></div>'+form+
    '<section class="card"><div class="tbl-wrap"><table><thead><tr><th>Invoice / client</th><th>Status</th><th class="r">Invoice total</th><th class="r">Received</th><th class="r">Balance</th><th>Payment history</th><th></th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="7">'+empty('No invoices to reconcile','Create an invoice to record payments.')+'</td></tr>')+'</tbody></table></div></section></div>';
}
function frequencyLabel(value){return {daily:'Daily',weekly:'Weekly',monthly:'Monthly',yearly:'Yearly'}[value]||'Monthly'}
function addPeriod(value,frequency){
  var date=new Date(value+'T12:00:00'),day=date.getDate();
  if(frequency==='daily')date.setDate(date.getDate()+1);
  else if(frequency==='weekly')date.setDate(date.getDate()+7);
  else if(frequency==='monthly'){date.setDate(1);date.setMonth(date.getMonth()+1);date.setDate(Math.min(day,new Date(date.getFullYear(),date.getMonth()+1,0).getDate()))}
  else{date.setDate(1);date.setFullYear(date.getFullYear()+1);date.setMonth(date.getMonth());date.setDate(Math.min(day,new Date(date.getFullYear(),date.getMonth()+1,0).getDate()))}
  return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
}
function recurringView(){
  var templatesList=store.invoices.filter(function(invoice){return invoice.status!=='draft'});
  var rows=store.recurring.map(function(item){return '<tr><td><b>'+esc(item.name)+'</b><small class="table-sub">'+esc(item.templateNumber)+'</small></td><td>'+frequencyLabel(item.frequency)+'</td><td>'+fmt(item.nextDate)+'</td>'+
    '<td>'+esc(item.endDate?fmt(item.endDate):'No end date')+'</td><td>'+(item.active?'<span class="pill s-sent">Active</span>':'<span class="pill s-draft">Paused</span>')+'</td><td class="r">'+
    (item.active&&item.nextDate<=app.today()?'<button class="btn sm primary" data-adv="generate-recurring" data-id="'+esc(item.id)+'">Generate due</button> ':'')+
    '<button class="btn sm" data-adv="toggle-recurring" data-id="'+esc(item.id)+'">'+(item.active?'Pause':'Resume')+'</button> <button class="btn sm danger" data-adv="delete-recurring" data-id="'+esc(item.id)+'">Cancel</button></td></tr>'}).join('');
  return '<div class="page"><div class="page-h"><div><h1>Recurring invoices</h1><p class="muted">Schedules run in this browser; no background scheduler is active.</p></div></div>'+
    '<section class="card"><h2>Create a schedule</h2><form id="recurring-form" class="stack"><div class="grid3">'+
    selectField('rc-invoice','Invoice template',templatesList.map(function(invoice){return {value:invoice.id,label:invoice.number+' · '+invoice.client.name}}),templatesList[0]&&templatesList[0].id||'')+
    selectField('rc-frequency','Frequency',['daily','weekly','monthly','yearly'].map(function(x){return {value:x,label:frequencyLabel(x)}}),'monthly')+
    field('rc-start','Start date',app.today(),'date','required')+field('rc-end','End date (optional)','','date')+'</div>'+
    '<div class="actions"><button class="btn primary" type="submit"'+(!templatesList.length?' disabled':'')+'>Save schedule</button></div></form></section>'+
    '<section class="card"><h2>Schedules</h2><div class="tbl-wrap"><table><thead><tr><th>Schedule / source</th><th>Frequency</th><th>Next invoice</th><th>End date</th><th>Status</th><th></th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="6">'+empty('No recurring schedules','Create a schedule from an existing invoice template.')+'</td></tr>')+'</tbody></table></div></section>'+
    '<div class="notice muted">Open this page to review invoices that are due. Select <b>Generate due</b> to create invoices; this browser cannot run a scheduler while it is closed.</div></div>';
}
function invoiceNumber(){
  var prefix=store.profile.prefix||'INV-',max=0;
  store.invoices.forEach(function(invoice){if(invoice.number.indexOf(prefix)===0){var n=parseInt(invoice.number.slice(prefix.length),10);if(n>max)max=n}});
  return prefix+String(max+1).padStart(4,'0');
}
function generateRecurring(schedule){
  var template=findInvoice(schedule.templateId);
  if(!template)throw new Error('The saved invoice template no longer exists.');
  var created=0,previous=clone(store),day=schedule.nextDate;
  while(day<=app.today()&&(!schedule.endDate||day<=schedule.endDate)&&created<100){
    var invoice=clone(template);
    invoice.id=uid();invoice.number=invoiceNumber();invoice.status='sent';invoice.paidOn='';invoice.payments=[];
    invoice.issue=day;invoice.due=app.addDays(day,+store.profile.terms||15);invoice.sample=false;invoice.recurringId=schedule.id;
    store.invoices.push(invoice);addActivity('invoice-created','Created recurring invoice '+invoice.number,invoice.id);
    store.notifications.unshift({id:uid(),type:'invoice',title:'Recurring invoice created',message:invoice.number+' for '+invoice.client.name,relatedId:invoice.id,at:new Date().toISOString(),read:false});
    created++;day=addPeriod(day,schedule.frequency);
  }
  schedule.nextDate=day;
  if(schedule.endDate&&schedule.nextDate>schedule.endDate)schedule.active=false;
  addActivity('recurring-generated','Generated '+created+' invoice'+(created===1?'':'s')+' from '+schedule.name,schedule.id);
  if(!app.save()){Object.keys(store).forEach(function(key){delete store[key]});Object.assign(store,previous);throw new Error('Recurring schedule could not be saved.')}
  updateNotificationCount();return created;
}
function reminderMessage(invoice){
  var template=store.reminderTemplate||'Dear {client}, this is a friendly reminder that invoice {invoice} for {amount} is due {due}. Kindly arrange payment at your earliest convenience.';
  return template.replace(/\{client\}/g,invoice.client.name).replace(/\{invoice\}/g,invoice.number)
    .replace(/\{amount\}/g,money(app.balance(invoice),invoice.currency)).replace(/\{due\}/g,status(invoice)==='overdue'?'overdue':fmt(invoice.due));
}
function remindersView(){
  var candidates=store.invoices.filter(function(invoice){var days=Math.round((new Date(invoice.due+'T12:00:00')-new Date(app.today()+'T12:00:00'))/864e5);return app.balance(invoice)>0&&invoice.status!=='draft'&&(days<=7)});
  var rows=candidates.map(function(invoice){return '<tr><td><b>'+esc(invoice.number)+'</b><small class="table-sub">'+esc(invoice.client.name)+'</small></td><td>'+fmt(invoice.due)+'</td><td>'+esc(status(invoice))+'</td><td class="r num">'+money(app.balance(invoice),invoice.currency)+'</td>'+
    '<td><button class="btn sm" data-adv="copy-reminder" data-id="'+esc(invoice.id)+'">Copy message</button> <button class="btn sm" data-adv="schedule-reminder" data-id="'+esc(invoice.id)+'">Schedule</button> <button class="btn sm primary" data-adv="record-reminder" data-id="'+esc(invoice.id)+'">Record reminder</button></td></tr>'}).join('');
  var history=store.reminders.slice().sort(function(a,b){return (b.at||b.scheduledFor||'').localeCompare(a.at||a.scheduledFor||'')}).map(function(item){return '<tr><td>'+fmt(dateOnly(item.at||item.scheduledFor))+'</td><td>'+esc(item.invoiceNumber)+'</td><td>'+esc(item.channel||'Scheduled')+' · '+esc(item.status||'recorded')+'</td><td>'+esc(item.message)+'</td></tr>'}).join('');
  var scheduledInvoice=findInvoice(scheduleReminderId);
  var scheduleForm=scheduledInvoice?'<section class="card"><h2>Schedule reminder · '+esc(scheduledInvoice.number)+'</h2><form id="reminder-schedule-form" class="stack">'+
    field('reminder-date','Reminder date',app.today(),'date','required')+textField('reminder-message','Message',reminderMessage(scheduledInvoice))+
    '<div class="actions"><button class="btn primary" type="submit">Save reminder schedule</button><button class="btn" type="button" data-adv="cancel-reminder-schedule">Cancel</button></div></form></section>':'';
  return '<div class="page"><div class="page-h"><div><h1>Payment reminders</h1><p class="muted">Prepare and track reminders. Sending email requires an email service or backend.</p></div></div>'+
    scheduleForm+'<section class="card"><h2>Due and overdue invoices</h2><div class="tbl-wrap"><table><thead><tr><th>Invoice / client</th><th>Due</th><th>Status</th><th class="r">Balance</th><th></th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="5">'+empty('No reminders due','No sent invoices are due in the next seven days or overdue.')+'</td></tr>')+'</tbody></table></div>'+
    '<div class="field" style="margin-top:16px"><label for="reminder-template">Reminder message template</label><textarea id="reminder-template">'+esc(store.reminderTemplate||'')+'</textarea><small class="muted">Placeholders: {client}, {invoice}, {amount}, {due}. Saved locally.</small></div></section>'+
    '<section class="card"><h2>Reminder history</h2><div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Invoice</th><th>Channel</th><th>Message</th></tr></thead><tbody>'+
    (history||'<tr><td colspan="4">'+empty('No reminders recorded','Copied messages and scheduled reminders appear here.')+'</td></tr>')+'</tbody></table></div></section></div>';
}
function rangeStart(period){
  var now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(period==='week'){start.setDate(start.getDate()-start.getDay())}
  else if(period==='last-month'){start=new Date(now.getFullYear(),now.getMonth()-1,1)}
  else if(period==='quarter'){start=new Date(now.getFullYear(),now.getMonth()-2,1)}
  else if(period==='year'){start=new Date(now.getFullYear(),0,1)}
  else if(period==='custom')return $('#report-from')&&$('#report-from').value||'0000-01-01';
  else start=new Date(now.getFullYear(),now.getMonth(),1);
  return start.getFullYear()+'-'+String(start.getMonth()+1).padStart(2,'0')+'-'+String(start.getDate()).padStart(2,'0');
}
function selectedDateEnd(){
  if(reportPeriod==='custom'&&$('#report-to')&&$('#report-to').value)return $('#report-to').value;
  return reportPeriod==='last-month'?new Date(new Date().getFullYear(),new Date().getMonth(),0).toISOString().slice(0,10):app.today();
}
function reportsView(){
  var start=rangeStart(reportPeriod),end=selectedDateEnd(),currency=reportCurrency;
  function inCurrency(invoice){return currency==='all'||invoice.currency===currency}
  var invoiced=store.invoices.filter(function(invoice){return invoice.status!=='draft'&&inCurrency(invoice)&&invoice.issue>=start&&invoice.issue<=end}).reduce(function(sum,invoice){return sum+app.calc(invoice).total},0);
  var received=0,overdue=0,outstanding=0;
  store.invoices.forEach(function(invoice){
    if(!inCurrency(invoice))return;
    (invoice.payments||[]).forEach(function(payment){if(!payment.voided&&payment.date>=start&&payment.date<=end)received+=+payment.amount||0});
    if(!(invoice.payments||[]).length&&invoice.status==='paid'&&invoice.paidOn>=start&&invoice.paidOn<=end)received+=app.calc(invoice).total;
    if(invoice.issue<=end){outstanding+=app.balance(invoice);if(status(invoice)==='overdue')overdue+=app.balance(invoice)}
  });
  var expenses=store.expenses.filter(function(item){return (currency==='all'||item.currency===currency)&&item.date>=start&&item.date<=end}).reduce(function(sum,item){return sum+item.amount},0);
  var net=received-expenses;
  var topCurrency=currency==='all'?store.profile.currency:currency;
  var topClients=store.clients.map(function(client){
    var total=store.invoices.filter(function(invoice){return (invoice.clientId===client.id||client.email&&invoice.client.email.toLowerCase()===client.email.toLowerCase())&&invoice.currency===topCurrency&&invoice.status!=='draft'&&invoice.issue>=start&&invoice.issue<=end})
      .reduce(function(sum,invoice){return sum+app.calc(invoice).total},0);
    return {client:client,total:total};
  }).filter(function(item){return item.total>0}).sort(function(a,b){return b.total-a.total}).slice(0,5);
  var statusCounts=['draft','sent','overdue','paid'].map(function(label){return '<span class="category-chip">'+label+': '+store.invoices.filter(function(invoice){return status(invoice)===label&&inCurrency(invoice)&&invoice.issue>=start&&invoice.issue<=end}).length+'</span>'}).join('');
  var monthly={},expenseMonthly={};
  store.invoices.forEach(function(invoice){
    if(!inCurrency(invoice))return;
    (invoice.payments||[]).forEach(function(payment){if(!payment.voided&&payment.date>=start&&payment.date<=end){var key=payment.date.slice(0,7)+(currency==='all'?' · '+invoice.currency:'');monthly[key]=(monthly[key]||0)+(+payment.amount||0)}});
    if(!(invoice.payments||[]).length&&invoice.status==='paid'&&invoice.paidOn>=start&&invoice.paidOn<=end){var key=invoice.paidOn.slice(0,7)+(currency==='all'?' · '+invoice.currency:'');monthly[key]=(monthly[key]||0)+app.calc(invoice).total}
  });
  store.expenses.forEach(function(item){if((currency==='all'||item.currency===currency)&&item.date>=start&&item.date<=end){var key=item.date.slice(0,7)+(currency==='all'?' · '+item.currency:'');expenseMonthly[key]=(expenseMonthly[key]||0)+item.amount}});
  var months=Array.from(new Set(Object.keys(monthly).concat(Object.keys(expenseMonthly)))).sort();
  var bestMonth=currency==='all'?'':months.slice().sort(function(a,b){return (monthly[b]||0)-(monthly[a]||0)})[0];
  if(bestMonth&&!(monthly[bestMonth]>0))bestMonth='';
  var maximum=Math.max.apply(null,months.map(function(month){return Math.max(monthly[month]||0,expenseMonthly[month]||0)}).concat([1]));
  var trend=months.map(function(month){var code=currency==='all'?month.split(' · ')[1]:currency,receivedValue=monthly[month]||0,expenseValue=expenseMonthly[month]||0;
    var receivedBar=currency==='all'?'':'<span class="bar-track"><i class="bar-revenue" style="width:'+Math.min(100,Math.round(receivedValue/maximum*100))+'%"></i></span>';
    var expenseBar=currency==='all'?'':'<span class="bar-track"><i class="bar-expense" style="width:'+Math.min(100,Math.round(expenseValue/maximum*100))+'%"></i></span>';
    return '<tr><td>'+esc(month)+'</td><td class="num"><b>'+money(receivedValue,code)+'</b>'+receivedBar+'</td>'+
      '<td class="num"><b>'+money(expenseValue,code)+'</b>'+expenseBar+'</td></tr>';
  }).join('');
  var currencyRows='';
  if(currency==='all'){
    var grouped={};
    store.invoices.forEach(function(invoice){
      var group=grouped[invoice.currency]||(grouped[invoice.currency]={invoiced:0,received:0,outstanding:0,overdue:0,expenses:0});
      if(invoice.status!=='draft'&&invoice.issue>=start&&invoice.issue<=end)group.invoiced+=app.calc(invoice).total;
      if(invoice.issue<=end){group.outstanding+=app.balance(invoice);if(status(invoice)==='overdue')group.overdue+=app.balance(invoice)}
      (invoice.payments||[]).forEach(function(payment){if(!payment.voided&&payment.date>=start&&payment.date<=end)group.received+=+payment.amount||0});
      if(!(invoice.payments||[]).length&&invoice.status==='paid'&&invoice.paidOn>=start&&invoice.paidOn<=end)group.received+=app.calc(invoice).total;
    });
    store.expenses.forEach(function(item){var group=grouped[item.currency]||(grouped[item.currency]={invoiced:0,received:0,outstanding:0,overdue:0,expenses:0});if(item.date>=start&&item.date<=end)group.expenses+=item.amount});
    currencyRows=Object.keys(grouped).sort().map(function(code){var group=grouped[code];return '<tr><td><b>'+esc(code)+'</b></td><td class="r num">'+money(group.invoiced,code)+'</td><td class="r num">'+money(group.received,code)+'</td><td class="r num">'+money(group.outstanding,code)+'</td><td class="r num">'+money(group.overdue,code)+'</td><td class="r num">'+money(group.expenses,code)+'</td><td class="r num">'+money(group.received-group.expenses,code)+'</td></tr>'}).join('');
  }
  return '<div class="page"><div class="page-h"><div><h1>Reports &amp; analytics</h1><p class="muted">Revenue received is based on payment records; it is not the same as invoices issued.</p></div>'+
    '<div class="actions"><button class="btn sm" data-adv="export-invoices">Invoices CSV</button><button class="btn sm" data-adv="export-financial">Financial CSV</button></div></div>'+
    '<section class="card"><div class="toolbar"><select id="report-period">'+[['week','This week'],['month','This month'],['last-month','Last month'],['quarter','Last 3 months'],['year','This year'],['custom','Custom range']].map(function(x){return '<option value="'+x[0]+'"'+(reportPeriod===x[0]?' selected':'')+'>'+x[1]+'</option>'}).join('')+'</select>'+
    '<input id="report-from" type="date" aria-label="Report start date" value="'+(reportPeriod==='custom'?start:'')+'"><input id="report-to" type="date" aria-label="Report end date" value="'+(reportPeriod==='custom'?end:'')+'">'+
    '<select id="report-currency"><option value="all"'+(currency==='all'?' selected':'')+'>All currencies (no conversion)</option>'+['INR','USD','EUR','GBP','AED','AUD','CAD','SGD'].map(function(c){return '<option'+(currency===c?' selected':'')+'>'+c+'</option>'}).join('')+'</select></div>'+
    (currency==='all'?'<div class="tbl-wrap report-currency-table"><table><thead><tr><th>Currency</th><th class="r">Invoiced</th><th class="r">Collected</th><th class="r">Outstanding</th><th class="r">Overdue</th><th class="r">Expenses</th><th class="r">Net</th></tr></thead><tbody>'+
      (currencyRows||'<tr><td colspan="7">'+empty('No financial activity','No records exist in this date range.')+'</td></tr>')+'</tbody></table></div><p class="notice">Values remain separate by currency; no exchange rates or conversions are applied.</p>':
    '<div class="stats"><div class="card stat"><div class="lbl">Total invoiced</div><div class="v num">'+money(invoiced,currency)+'</div></div>'+
    '<div class="card stat good"><div class="lbl">Collected in period</div><div class="v num">'+money(received,currency)+'</div></div>'+
    '<div class="card stat"><div class="lbl">Outstanding receivables</div><div class="v num">'+money(outstanding,currency)+'</div></div>'+
    '<div class="card stat bad"><div class="lbl">Overdue balance</div><div class="v num">'+money(overdue,currency)+'</div></div>'+
    '<div class="card stat"><div class="lbl">Expenses</div><div class="v num">'+money(expenses,currency)+'</div></div>'+
    '<div class="card stat '+(net>=0?'good':'bad')+'"><div class="lbl">Net income (received − expenses)</div><div class="v num">'+money(net,currency)+'</div></div></div>')+'</section>'+
    '<section class="cols"><div class="card"><h2>Revenue and expense trends</h2>'+(bestMonth?'<p class="notice">Best collection month in this range: <b>'+esc(bestMonth)+'</b> · '+money(monthly[bestMonth]||0,currency)+'</p>':'')+'<div class="tbl-wrap"><table><thead><tr><th>Month</th><th class="r">Received</th><th class="r">Expenses</th></tr></thead><tbody>'+
    (trend||'<tr><td colspan="3">'+empty('No activity in this range','Choose a different date range or add transactions.')+'</td></tr>')+'</tbody></table></div></div>'+
    '<div class="card"><h2>Top clients by invoiced amount · '+esc(topCurrency)+'</h2><div class="list">'+(topClients.length?topClients.map(function(item){return '<div class="row"><span>'+esc(item.client.name)+'</span><b class="num">'+money(item.total,topCurrency)+'</b></div>'}).join(''):empty('No clients yet','Add client records to see this report.'))+'</div>'+
    '<h2 style="margin-top:20px">Invoice status</h2><div class="category-list">'+statusCounts+'</div></div></section></div>';
}
function notificationsView(){
  var rows=store.notifications.map(function(item){return '<article class="notification'+(item.read?' read':'')+'"><div><b>'+esc(item.title)+'</b><p>'+esc(item.message)+'</p><small>'+esc(new Date(item.at).toLocaleString())+'</small></div>'+
    '<button class="btn sm" data-adv="read-notification" data-id="'+esc(item.id)+'">'+(item.read?'Read':'Mark read')+'</button></article>'}).join('');
  return '<div class="page"><div class="page-h"><div><h1>Notifications</h1><p class="muted">Local reminders and application events.</p></div><div class="actions"><button class="btn sm" data-adv="read-all">Mark all read</button><button class="btn sm danger" data-adv="clear-notifications">Clear history</button></div></div>'+
    '<section class="card">'+(rows||empty('You are all caught up','Upcoming due dates and application events appear here.'))+'</section>'+
    '<p class="notice muted">Notifications are stored in this browser only. They are not push or email notifications.</p></div>';
}
function exportCSV(filename,rows){
  var text=rows.map(function(row){return row.map(function(value){return '"'+String(value==null?'':value).replace(/"/g,'""')+'"'}).join(',')}).join('\r\n');
  var blob=new Blob(['\ufeff'+text],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();window.setTimeout(function(){URL.revokeObjectURL(url)},1000);app.toast(filename+' download started');
}
function invoicesCSV(){exportCSV('invoicepro-invoices.csv',[['Invoice','Client','Email','Issue date','Due date','Currency','Total','Received','Balance','Status']].concat(store.invoices.map(function(invoice){
  return [invoice.number,invoice.client.name,invoice.client.email,invoice.issue,invoice.due,invoice.currency,app.calc(invoice).total,calcPaid(invoice),app.balance(invoice),status(invoice)];
})))}
function clientsCSV(){exportCSV('invoicepro-clients.csv',[['Name','Company','Email','Phone','Address','Tax ID','Totals by currency','Notes']].concat(store.clients.map(function(client){return [client.name,client.company,client.email,client.phone,client.address,client.taxId,clientCurrencyTotals(client).replace(/<br>/g,' | '),client.notes]})))}
function expensesCSV(){exportCSV('invoicepro-expenses.csv',[['Date','Vendor','Category','Description','Method','Currency','Amount']].concat(store.expenses.map(function(item){return [item.date,item.vendor,item.category,item.description,item.method,item.currency,item.amount]})))}
function financialCSV(){
  var start=rangeStart(reportPeriod),end=selectedDateEnd(),rows=[['Type','Date','Reference','Currency','Amount']];
  store.invoices.forEach(function(invoice){
    if((reportCurrency==='all'||invoice.currency===reportCurrency)&&invoice.status!=='draft'&&invoice.issue>=start&&invoice.issue<=end)
      rows.push(['Invoice issued',invoice.issue,invoice.number,invoice.currency,app.calc(invoice).total]);
    (invoice.payments||[]).forEach(function(payment){
      if(!payment.voided&&(reportCurrency==='all'||invoice.currency===reportCurrency)&&payment.date>=start&&payment.date<=end)
        rows.push(['Payment received',payment.date,invoice.number,invoice.currency,payment.amount]);
    });
    if(!(invoice.payments||[]).length&&invoice.status==='paid'&&invoice.paidOn>=start&&invoice.paidOn<=end&&
      (reportCurrency==='all'||invoice.currency===reportCurrency))rows.push(['Payment received',invoice.paidOn,invoice.number,invoice.currency,app.calc(invoice).total]);
  });
  store.expenses.forEach(function(item){if((reportCurrency==='all'||item.currency===reportCurrency)&&item.date>=start&&item.date<=end)rows.push(['Expense',item.date,item.vendor,item.currency,item.amount])});
  exportCSV('invoicepro-financial-report.csv',rows);
}
function downloadJSON(){
  var payload=JSON.stringify({format:'invoicepro-backup-v1',exportedAt:new Date().toISOString(),data:store},null,2);
  var blob=new Blob([payload],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='invoicepro-backup.json';document.body.appendChild(link);link.click();link.remove();window.setTimeout(function(){URL.revokeObjectURL(url)},1000);app.toast('JSON backup download started');
}
function validBackup(data){
  if(!data||data.format!=='invoicepro-backup-v1'||!data.data||!data.data.profile||!Array.isArray(data.data.invoices)||
    !Array.isArray(data.data.clients)||!Array.isArray(data.data.expenses)||!Array.isArray(data.data.recurring)||
    !Array.isArray(data.data.reminders)||!Array.isArray(data.data.notifications)||!Array.isArray(data.data.activity))return false;
  var codes=['INR','USD','EUR','GBP','AED','AUD','CAD','SGD'];
  if(codes.indexOf(data.data.profile.currency)<0||!isFinite(+data.data.profile.tax)||+data.data.profile.tax<0||
    !isFinite(+data.data.profile.terms)||+data.data.profile.terms<0)return false;
  var invoiceIds=data.data.invoices.map(function(item){return item&&item.id}),numbers=data.data.invoices.map(function(item){return item&&String(item.number).toLowerCase()});
  if(new Set(invoiceIds).size!==invoiceIds.length||new Set(numbers).size!==numbers.length)return false;
  if(data.data.invoices.some(function(item){return !item||typeof item.id!=='string'||typeof item.number!=='string'||!item.client||typeof item.client.name!=='string'||
    !Array.isArray(item.items)||!item.items.every(function(line){return isFinite(+line.q)&&+line.q>0&&isFinite(+line.r)&&+line.r>=0})||
    !isFinite(app.calc(item).total)||['draft','sent','paid'].indexOf(item.status)<0||codes.indexOf(item.currency)<0||
    (item.payments&&!Array.isArray(item.payments))||(item.payments||[]).some(function(payment){return !payment||!isFinite(+payment.amount)||+payment.amount<=0||!/^\d{4}-\d{2}-\d{2}$/.test(payment.date||'')})||
    !/^\d{4}-\d{2}-\d{2}$/.test(item.issue||'')||!/^\d{4}-\d{2}-\d{2}$/.test(item.due||'')}))return false;
  if(data.data.clients.some(function(item){return !item||typeof item.id!=='string'||typeof item.name!=='string'}))return false;
  if(data.data.expenses.some(function(item){return !item||typeof item.id!=='string'||!isFinite(+item.amount)||+item.amount<=0||!/^\d{4}-\d{2}-\d{2}$/.test(item.date||'')||codes.indexOf(item.currency)<0||
    (item.receipt&&(!/^data:(image\/(png|jpeg|gif|webp)|application\/pdf);base64,/.test(item.receipt)||item.receipt.length>1500000))}))return false;
  if(data.data.document){
    if(['modern','classic','minimal','professional'].indexOf(data.data.document.template||'modern')<0||
      !/^#[0-9a-f]{6}$/i.test(data.data.document.color||'#2447D6')||
      (data.data.document.logo&&(!/^data:image\/(png|jpeg|gif|webp);base64,/.test(data.data.document.logo)||data.data.document.logo.length>1500000)))return false;
  }
  if(data.data.recurring.some(function(item){return !item||typeof item.id!=='string'||!data.data.invoices.some(function(invoice){return invoice.id===item.templateId})||['daily','weekly','monthly','yearly'].indexOf(item.frequency)<0||
    !/^\d{4}-\d{2}-\d{2}$/.test(item.nextDate||'')}))return false;
  return true;
}
function dataView(){
  var prefs=store.preferences||{},documentSettings=store.document||{};
  return '<div class="page"><div class="page-h"><div><h1>Data &amp; document settings</h1><p class="muted">Back up or restore browser-local records and customize invoice output.</p></div></div>'+
    '<div class="cols"><section class="card"><h2>Backup and restore</h2><p class="muted">Exports include invoices, payments, clients, expenses, schedules and business settings. Authentication data is never included.</p>'+
    '<div class="actions"><button class="btn primary" data-adv="backup">Download JSON backup</button><label class="btn" for="backup-file">Choose backup file</label><input id="backup-file" class="sr-only" type="file" accept="application/json,.json"></div>'+
    '<p class="notice">Restore replaces the current InvoicePro data after validation and confirmation. Keep a backup before importing.</p></section>'+
    '<section class="card"><h2>Invoice templates</h2><div class="stack">'+selectField('doc-template','Default template',Object.keys(templates).map(function(key){return {value:key,label:templates[key]}}),documentSettings.template||'modern')+
    field('doc-color','Accent color',documentSettings.color||'#2447D6','color')+textField('doc-footer','Invoice footer',documentSettings.footer)+
    '<label class="check-control"><input id="doc-show-tax" type="checkbox"'+(documentSettings.showTax===false?'':' checked')+'> Display tax line details</label>'+
    '<div class="field"><label for="doc-logo">Business logo (PNG, JPEG, GIF, or WebP; max 1 MB)</label><input id="doc-logo" type="file" accept=".png,.jpg,.jpeg,.gif,.webp"></div><button class="btn primary" data-adv="save-document">Save document settings</button>'+
    (documentSettings.logo?'<button class="btn" data-adv="remove-logo">Remove current logo</button>':'')+'</div></section></div>'+
    '<section class="card"><h2>Dashboard personalization</h2><p class="muted">Choose visible widgets and their display order on the dashboard.</p><div class="preferences-list">'+
    ['stats','chart','recent','upcoming','top-clients','activity'].map(function(widget){var visible=!prefs.visible||prefs.visible[widget]!==false;return '<div class="preference-row"><label class="check-control"><input type="checkbox" data-widget-toggle="'+widget+'"'+(visible?' checked':'')+'> '+({stats:'Financial summary cards',chart:'Monthly revenue chart',recent:'Recent invoices',upcoming:'Upcoming payments', 'top-clients':'Top clients',activity:'Recent activity'}[widget])+'</label>'+
      '<button class="btn sm" data-adv="move-widget-up" data-widget="'+widget+'">Move up</button><button class="btn sm" data-adv="move-widget-down" data-widget="'+widget+'">Move down</button></div>'}).join('')+
    '</div>'+selectField('default-view','Default app view',[{value:'dashboard',label:'Dashboard'},{value:'invoices',label:'Invoices'}],prefs.defaultView||'dashboard')+
    '<button class="btn primary" data-adv="save-preferences">Save preferences</button></section>'+
    '<section class="card"><h2>Other modules</h2><div class="actions"><a class="btn" href="#reminders">Payment reminders</a><a class="btn" href="#activity">Activity log</a><a class="btn" href="#templates">Invoice preview</a></div>'+
    '<p class="notice muted">Browser storage is device- and origin-specific. This export is not a shared database or tamper-proof audit log.</p></section></div>';
}
function templatesView(){
  var settings=store.document||{};
  var sample=store.invoices[0]||{number:'INV-0001',client:{name:'Example client',email:'client@example.test',address:'Client address'},issue:app.today(),due:app.addDays(app.today(),15),currency:store.profile.currency,items:[{d:'Professional services',q:1,r:250}],discount:0,tax:store.profile.tax||0,status:'sent'};
  var html=app.invoicePreview(sample);
  return '<div class="page"><div class="page-h"><div><h1>Invoice template preview</h1><p class="muted">Select a template and customize its accent color in Data &amp; document settings.</p></div><a class="btn" href="#data">Customize</a></div>'+
    '<section class="card"><div class="actions">'+Object.keys(templates).map(function(key){return '<button class="btn'+((settings.template||'modern')===key?' primary':'')+'" data-adv="select-template" data-template="'+key+'">'+templates[key]+'</button>'}).join('')+'</div>'+
    '<div class="template-preview">'+html+'</div></section></div>';
}
function activityView(){
  var rows=store.activity.map(function(item){return '<tr><td>'+esc(new Date(item.at).toLocaleString())+'</td><td>'+esc(item.type.replace(/-/g,' '))+'</td><td>'+esc(item.description)+'</td></tr>'}).join('');
  return '<div class="page"><div class="page-h"><div><h1>Activity log</h1><p class="muted">A convenience history stored in this browser; it is not tamper-proof.</p></div></div><section class="card"><div class="tbl-wrap"><table><thead><tr><th>Date and time</th><th>Event</th><th>Description</th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="3">'+empty('No activity recorded','Actions in the app will appear here.')+'</td></tr>')+'</tbody></table></div></section></div>';
}
function preferencesView(){return dataView()}
function quickView(){
  return '<div class="page"><div class="page-h"><h1>Quick actions</h1></div><section class="card"><div class="quick-grid">'+
    [['Create invoice','#new'],['Add client','#clients'],['Add expense','#expenses'],['Record payment','#payments'],['View reports','#reports'],['Manage recurring','#recurring'],['Reminders','#reminders'],['Backup data','#data']].map(function(item){return '<a class="btn" href="'+item[1]+'">'+item[0]+'</a>'}).join('')+
    '</div></section></div>';
}
function saveEntity(list,item,oldId,message,type){
  var index=list.findIndex(function(record){return record.id===oldId});
  if(index<0){list.unshift(item)}else{list[index]=item}
  addActivity(type,message,item.id);
  if(!persist()){if(index<0)list.shift();else list[index]=store[type==='client-created'||type==='client-edited'?'clients':'expenses'][index];return false}
  app.render();app.toast(message);return true;
}
function saveClient(event){
  event.preventDefault();
  var id=clientEdit||uid(),old=store.clients.filter(function(item){return item.id===clientEdit})[0];
  var client={id:id,name:$('#cl-name').value.trim(),company:$('#cl-company').value.trim(),email:$('#cl-email').value.trim().toLowerCase(),
    phone:$('#cl-phone').value.trim(),taxId:$('#cl-tax').value.trim(),address:$('#cl-address').value.trim(),notes:$('#cl-notes').value.trim(),createdAt:old&&old.createdAt||new Date().toISOString()};
  if(!client.name){app.toast('Client name is required.');return}
  if(client.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)){app.toast('Enter a valid client email address.');return}
  if(store.clients.some(function(item){return item.email&&item.email===client.email&&item.id!==id})){app.toast('A client with this email already exists.');return}
  var previous=clone(store.clients),previousActivity=clone(store.activity),idx=store.clients.findIndex(function(item){return item.id===id});
  if(idx<0)store.clients.unshift(client);else store.clients[idx]=client;
  addActivity(old?'client-edited':'client-created',(old?'Updated ':'Added ')+client.name,client.id);
  if(!persist()){store.clients=previous;store.activity=previousActivity;return}
  clientEdit='';app.render();app.toast('Client saved');
}
function saveExpense(event){
  event.preventDefault();
  var amount=Number($('#ex-amount').value),old=expenseEdit&&store.expenses.filter(function(item){return item.id===expenseEdit})[0];
  var item={id:expenseEdit||uid(),vendor:$('#ex-vendor').value.trim(),category:$('#ex-category').value,date:$('#ex-date').value,amount:amount,
    method:$('#ex-method').value,currency:old&&old.currency||store.profile.currency,description:$('#ex-description').value.trim(),
    receipt:receiptData||old&&old.receipt||'',receiptName:receiptData?$('#ex-receipt').files[0].name:old&&old.receiptName||''};
  if(!item.vendor||!item.date||!isFinite(amount)||amount<=0){app.toast('Enter a vendor, valid date, and positive amount.');return}
  var previous=clone(store.expenses),previousActivity=clone(store.activity),index=store.expenses.findIndex(function(expense){return expense.id===item.id});
  if(index<0)store.expenses.unshift(item);else store.expenses[index]=item;
  addActivity(old?'expense-edited':'expense-added',(old?'Updated ':'Added ')+item.category+' expense for '+item.vendor,item.id);
  if(!persist()){store.expenses=previous;store.activity=previousActivity;return}
  expenseEdit='';receiptData='';app.render();app.toast('Expense saved');
}
function savePayment(event){
  event.preventDefault();
  var invoice=findInvoice(paymentInvoice),amount=Number($('#pm-amount').value),date=$('#pm-date').value;
  if(!invoice){app.toast('Invoice was not found.');return}
  if(!isFinite(amount)||amount<=0||amount>app.balance(invoice)+0.001){app.toast('Enter an amount above zero and no greater than the remaining balance.');return}
  if(!date){app.toast('Choose a payment date.');return}
  var previous=clone(store);
  invoice.payments=invoice.payments||[];
  invoice.payments.push({id:uid(),amount:Math.round(amount*100)/100,date:date,method:$('#pm-method').value,reference:$('#pm-reference').value.trim(),note:$('#pm-note').value.trim()});
  if(app.balance(invoice)<=0.005){invoice.status='paid';invoice.paidOn=date}
  addActivity('payment-recorded','Recorded '+money(amount,invoice.currency)+' payment for '+invoice.number,invoice.id);
  store.notifications.unshift({id:uid(),type:'payment',title:'Payment recorded',message:money(amount,invoice.currency)+' received for '+invoice.number,relatedId:invoice.id,at:new Date().toISOString(),read:false});
  if(!app.save()){
    Object.keys(store).forEach(function(key){delete store[key]});Object.keys(previous).forEach(function(key){store[key]=previous[key]});return;
  }
  paymentInvoice='';app.render();app.toast('Payment recorded');updateNotificationCount();
}
function saveRecurring(event){
  event.preventDefault();
  var invoice=findInvoice($('#rc-invoice').value),start=$('#rc-start').value,end=$('#rc-end').value;
  if(!invoice||!start||!/^\d{4}-\d{2}-\d{2}$/.test(start)){app.toast('Choose an invoice template and a valid start date.');return}
  if(end&&end<start){app.toast('The end date must be on or after the start date.');return}
  var schedule={id:uid(),name:invoice.client.name+' · '+invoice.number,templateId:invoice.id,templateNumber:invoice.number,frequency:$('#rc-frequency').value,startDate:start,endDate:end,nextDate:start,active:true,createdAt:new Date().toISOString()};
  if(transaction(function(){store.recurring.unshift(schedule);addActivity('recurring-created','Created '+frequencyLabel(schedule.frequency)+' schedule for '+schedule.name,schedule.id)},'Recurring schedule saved'))app.render();
}
function recordReminder(invoice,channel){
  var message=reminderMessage(invoice),entry={id:uid(),invoiceId:invoice.id,invoiceNumber:invoice.number,message:message,channel:channel,at:new Date().toISOString()};
  if(!transaction(function(){store.reminders.unshift(entry);addActivity('reminder-created','Prepared reminder for '+invoice.number,invoice.id)},channel==='copy'?'Reminder copied':'Reminder recorded'))return;
}
function saveReminderSchedule(event){
  event.preventDefault();
  var invoice=findInvoice(scheduleReminderId),date=$('#reminder-date').value,message=$('#reminder-message').value.trim();
  if(!invoice||!date||!message){app.toast('Choose a reminder date and enter a message.');return}
  var item={id:uid(),invoiceId:invoice.id,invoiceNumber:invoice.number,message:message,channel:'Scheduled',scheduledFor:date,status:'scheduled',at:new Date().toISOString()};
  if(transaction(function(){store.reminders.unshift(item);addActivity('reminder-scheduled','Scheduled a reminder for '+invoice.number,item.id)},'Reminder scheduled')){scheduleReminderId='';app.render()}
}
function applyTheme(){
  var theme='light';
  try{theme=localStorage.getItem('invoicepro.theme')||'light'}catch(error){console.warn('InvoicePro theme preference is unavailable.',error)}
  document.documentElement.setAttribute('data-theme',theme);
  var button=$('[data-adv="theme-toggle"]');if(button)button.textContent=theme==='dark'?'Light mode':'Dark mode';
}
function search(query){
  var target=$('#search-results'),q=query.trim().toLowerCase();
  if(!target)return;
  if(!q){target.hidden=true;target.innerHTML='';return}
  var matches=[];
  store.invoices.forEach(function(invoice){if((invoice.number+' '+invoice.client.name+' '+invoice.client.email).toLowerCase().indexOf(q)>-1)matches.push('<button class="search-result" data-a="open" data-id="'+esc(invoice.id)+'"><b>'+esc(invoice.number)+'</b><span>'+esc(invoice.client.name)+' · '+money(app.calc(invoice).total,invoice.currency)+'</span></button>')});
  store.clients.forEach(function(client){if((client.name+' '+client.company+' '+client.email).toLowerCase().indexOf(q)>-1)matches.push('<a class="search-result" href="#clients"><b>'+esc(client.name)+'</b><span>'+esc(client.email||client.company||'Client')+'</span></a>')});
  store.expenses.forEach(function(item){if((item.vendor+' '+item.description+' '+item.category).toLowerCase().indexOf(q)>-1)matches.push('<a class="search-result" href="#expenses"><b>'+esc(item.vendor)+'</b><span>'+esc(item.category)+' · '+money(item.amount,item.currency)+'</span></a>')});
  target.innerHTML=matches.slice(0,12).join('')||'<div class="search-result muted">No matching records</div>';target.hidden=false;
}
function renderOnClick(event){
  var button=event.target.closest('[data-adv]');if(!button)return;
  var action=button.getAttribute('data-adv'),id=button.getAttribute('data-id'),invoice=findInvoice(id);
  if(action==='quick-toggle'){location.hash='#quick-actions';return}
  if(action==='theme-toggle'){
    var theme=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
    try{localStorage.setItem('invoicepro.theme',theme);applyTheme()}catch(error){app.toast('Theme preference could not be saved in browser storage.');console.error(error)}
    return
  }
  if(action==='edit-client'){clientEdit=id;reminderDraft='';app.render();return}
  if(action==='cancel-client'){clientEdit='';app.render();return}
  if(action==='view-client'){reminderDraft=id;app.render();return}
  if(action==='close-client-history'){reminderDraft='';app.render();return}
  if(action==='delete-client'){
    var client=store.clients.filter(function(item){return item.id===id})[0];if(!client)return;
    if(store.invoices.some(function(item){return item.clientId===id})&&!window.confirm('This client has linked invoices. Delete the client record but keep its invoices?'))return;
    if(!window.confirm('Delete '+client.name+'?'))return;
    if(transaction(function(){store.clients=store.clients.filter(function(item){return item.id!==id});addActivity('client-deleted','Deleted client '+client.name,id)},'Client deleted'))app.render();return;
  }
  if(action==='edit-expense'){expenseEdit=id;receiptData='';app.render();return}
  if(action==='cancel-expense'){expenseEdit='';receiptData='';app.render();return}
  if(action==='delete-expense'){
    var expense=store.expenses.filter(function(item){return item.id===id})[0];if(!expense||!window.confirm('Delete this expense?'))return;
    if(transaction(function(){store.expenses=store.expenses.filter(function(item){return item.id!==id});addActivity('expense-deleted','Deleted expense for '+expense.vendor,id)},'Expense deleted'))app.render();return;
  }
  if(action==='record-payment'){paymentInvoice=id;app.render();return}
  if(action==='cancel-payment'){paymentInvoice='';app.render();return}
  if(action==='toggle-recurring'){
    var schedule=store.recurring.filter(function(item){return item.id===id})[0];if(schedule){var wasActive=schedule.active;if(transaction(function(){schedule.active=!schedule.active;addActivity('recurring-updated',(schedule.active?'Resumed ':'Paused ')+schedule.name,id)},wasActive?'Schedule paused':'Schedule resumed'))app.render()}return;
  }
  if(action==='delete-recurring'){
    var active=store.recurring.filter(function(item){return item.id===id})[0];if(!active||!window.confirm('Cancel this recurring schedule? Generated invoices are kept.'))return;
    if(transaction(function(){store.recurring=store.recurring.filter(function(item){return item.id!==id});addActivity('recurring-cancelled','Cancelled '+active.name,id)},'Schedule cancelled'))app.render();return;
  }
  if(action==='generate-recurring'){
    var due=store.recurring.filter(function(item){return item.id===id})[0];if(!due)return;
    try{var count=generateRecurring(due);app.render();app.toast(count+' invoice'+(count===1?'':'s')+' generated')}catch(error){app.toast(error.message)}return;
  }
  if(action==='copy-reminder'&&invoice){
    var text=reminderMessage(invoice);
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(function(){recordReminder(invoice,'copy')},function(){window.prompt('Copy this reminder:',text);recordReminder(invoice,'copy')});
    else{window.prompt('Copy this reminder:',text);recordReminder(invoice,'copy')}return;
  }
  if(action==='record-reminder'&&invoice){recordReminder(invoice,'manual');app.render();return}
  if(action==='schedule-reminder'&&invoice){scheduleReminderId=id;app.render();return}
  if(action==='cancel-reminder-schedule'){scheduleReminderId='';app.render();return}
  if(action==='read-notification'){var note=store.notifications.filter(function(item){return item.id===id})[0];if(note&&transaction(function(){note.read=true})){app.render();updateNotificationCount()}return}
  if(action==='read-all'){if(transaction(function(){store.notifications.forEach(function(item){item.read=true})})){app.render();updateNotificationCount()}return}
  if(action==='clear-notifications'){if(window.confirm('Clear notification history?')&&transaction(function(){store.notifications=[]})){app.render();updateNotificationCount()}return}
  if(action==='export-invoices'){invoicesCSV();return}
  if(action==='export-clients'){clientsCSV();return}
  if(action==='export-expenses'){expensesCSV();return}
  if(action==='export-financial'){financialCSV();return}
  if(action==='backup'){downloadJSON();return}
  if(action==='save-document'){
    if(transaction(function(){store.document.template=$('#doc-template').value;store.document.color=$('#doc-color').value;store.document.footer=$('#doc-footer').value;
      store.document.showTax=$('#doc-show-tax').checked;store.document.logo=logoData||store.document.logo||''},'Document settings saved')){logoData='';app.render()}return;
  }
  if(action==='remove-logo'){if(transaction(function(){store.document.logo='';logoData=''},'Logo removed'))app.render();return}
  if(action==='select-template'){if(transaction(function(){store.document.template=button.getAttribute('data-template')},'Template selected'))app.render();return}
  if(action==='save-preferences'){
    if(transaction(function(){store.preferences=store.preferences||{};store.preferences.defaultView=$('#default-view').value},'Dashboard preferences saved'))app.render();return;
  }
  if(action==='move-widget-up'||action==='move-widget-down'){
    var order=store.preferences.order||['stats','chart','recent'],widget=button.getAttribute('data-widget'),index=order.indexOf(widget),to=action==='move-widget-up'?index-1:index+1;
    if(index>=0&&to>=0&&to<order.length){transaction(function(){var moving=order[index];order.splice(index,1);order.splice(to,0,moving);store.preferences.order=order},'Widget order updated');app.render()}return;
  }
}
document.addEventListener('click',renderOnClick);
document.addEventListener('input',function(event){
  if(event.target.id==='client-search'){clientQuery=event.target.value;var focused=event.target.selectionStart;app.render();var input=$('#client-search');input.focus();input.setSelectionRange(focused,focused)}
  if(event.target.id==='expense-search'){expenseQuery=event.target.value;var pos=event.target.selectionStart;app.render();var input2=$('#expense-search');input2.focus();input2.setSelectionRange(pos,pos)}
  if(event.target.id==='global-search')search(event.target.value);
});
document.addEventListener('change',function(event){
  var target=event.target;
  if(target.id==='reminder-template'){
    if(target.value.trim().length<10||target.value.length>1000){app.toast('Reminder template must be between 10 and 1,000 characters.');target.value=store.reminderTemplate;return}
    transaction(function(){store.reminderTemplate=target.value.trim()},'Reminder template saved');
  }
  if(target.id==='expense-category'){expenseCategory=target.value;app.render()}
  if(target.id==='report-period'){reportPeriod=target.value;app.render()}
  if(target.id==='report-currency'){reportCurrency=target.value;app.render()}
  if(target.id==='report-from'||target.id==='report-to'){if(reportPeriod==='custom')app.render()}
  if(target.hasAttribute('data-widget-toggle')){transaction(function(){store.preferences=store.preferences||{};store.preferences.visible=store.preferences.visible||{};store.preferences.visible[target.getAttribute('data-widget-toggle')]=target.checked});app.render()}
  if(target.id==='doc-logo'||target.id==='ex-receipt'){
    var file=target.files&&target.files[0];if(!file)return;
    if(file.size>1024*1024){app.toast('File must be no larger than 1 MB.');target.value='';return}
    if(target.id==='doc-logo'&&!/^image\/(png|jpeg|gif|webp)$/.test(file.type)){app.toast('Choose a PNG, JPEG, GIF, or WebP image file.');target.value='';return}
    if(target.id==='ex-receipt'&&!/^(image\/(png|jpeg|gif|webp)|application\/pdf)$/.test(file.type)){app.toast('Choose a PNG, JPEG, GIF, WebP, or PDF receipt.');target.value='';return}
    var reader=new FileReader();reader.onload=function(){if(target.id==='doc-logo'){logoData=String(reader.result);app.toast('Logo ready. Save document settings to keep it.')}else{receiptData=String(reader.result);var label=$('#receipt-label');if(label)label.textContent=file.name}};
    reader.onerror=function(){app.toast('The file could not be read.')};reader.readAsDataURL(file);
  }
});
document.addEventListener('submit',function(event){
  if(event.target.id==='client-form')saveClient(event);
  if(event.target.id==='expense-form')saveExpense(event);
  if(event.target.id==='payment-form')savePayment(event);
  if(event.target.id==='recurring-form')saveRecurring(event);
  if(event.target.id==='reminder-schedule-form')saveReminderSchedule(event);
});
document.addEventListener('change',function(event){
  if(event.target.id==='backup-file'){
    var file=event.target.files&&event.target.files[0];if(!file)return;
    if(file.size>10*1024*1024){app.toast('Backup file is too large (10 MB maximum).');event.target.value='';return}
    var reader=new FileReader();reader.onload=function(){
      var payload;try{payload=JSON.parse(String(reader.result))}catch(error){app.toast('The selected file is not valid JSON.');return}
      if(!validBackup(payload)){app.toast('Backup validation failed. Existing data was not changed.');return}
      if(!window.confirm('Replace all current InvoicePro records with this backup? Download a backup first if needed.'))return;
      var previous=clone(store),incoming=clone(payload.data),allowed=['profile','invoices','clients','expenses','recurring','reminders','notifications','activity','preferences','document','reminderTemplate'];
      Object.keys(store).forEach(function(key){delete store[key]});allowed.forEach(function(key){if(Object.prototype.hasOwnProperty.call(incoming,key))store[key]=incoming[key]});
      if(app.save()){app.toast('Backup restored');applyTheme();app.render()}else{Object.keys(store).forEach(function(key){delete store[key]});Object.keys(previous).forEach(function(key){store[key]=previous[key]})}
    };reader.onerror=function(){app.toast('The backup file could not be read.')};reader.readAsText(file);
  }
});
function start(){
  applyTheme();
  store.preferences=store.preferences||{visible:{},order:[],defaultView:'dashboard'};
  store.preferences.visible=store.preferences.visible||{};
  store.preferences.order=Array.isArray(store.preferences.order)?store.preferences.order:[];
  ['stats','chart','recent','upcoming','top-clients','activity'].forEach(function(widget){
    if(store.preferences.order.indexOf(widget)<0)store.preferences.order.push(widget);
    if(typeof store.preferences.visible[widget]!=='boolean')store.preferences.visible[widget]=true;
  });
  store.document=store.document||{template:'modern',color:'#2447D6',footer:'',showTax:true,logo:''};
  notifyUpcoming();
  app.registerRoutes({clients:clientsView,expenses:expenseView,payments:paymentsView,recurring:recurringView,
    reports:reportsView,notifications:notificationsView,reminders:remindersView,data:dataView,preferences:preferencesView,
    templates:templatesView,activity:activityView,'quick-actions':quickView});
  var searchInput=$('#global-search');if(searchInput)searchInput.addEventListener('keydown',function(event){if(event.key==='Escape'){searchInput.value='';search('')}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
