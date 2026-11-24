(function(){
'use strict';
var USERS_KEY='invoicepro.auth.users.v1';
var SESSION_KEY='invoicepro.auth.session.v1';
var RESET_KEY='invoicepro.auth.reset.v1';
var sessionError='';
var $=function(selector,root){return (root||document).querySelector(selector)};
var page=location.pathname.split('/').pop()||'index.html';
var savedTheme='light';
try{savedTheme=localStorage.getItem('invoicepro.theme')||'light'}catch(themeError){console.warn('InvoicePro theme preference is unavailable.',themeError)}
document.documentElement.setAttribute('data-theme',savedTheme);

function readJSON(key,fallback){
  var value=localStorage.getItem(key);
  if(!value)return fallback;
  try{return JSON.parse(value)}catch(error){throw new Error('Saved authentication data is invalid. Clear this browser\'s InvoicePro auth data and try again.')}
}
function users(){var records=readJSON(USERS_KEY,[]);if(!Array.isArray(records))throw new Error('Saved accounts are invalid.');return records}
function session(){
  try{
    var persistent=readJSON(SESSION_KEY,null);
    var temporary=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
    return persistent||temporary;
  }catch(error){sessionError=error.message;return null}
}
function getUser(email){return users().filter(function(user){return user.email===email})[0]||null}
function showMessage(element,message,success){
  if(!element)return;
  element.textContent=message;
  element.classList.toggle('success',!!success);
  element.hidden=false;
}
function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}
function strongPassword(value){return value.length>=8&&/[A-Za-z]/.test(value)&&/[0-9]/.test(value)}
function randomSalt(){
  if(!window.crypto||!window.crypto.getRandomValues)throw new Error('Secure browser cryptography is unavailable. Use VS Code Live Server or a modern browser.');
  var bytes=new Uint8Array(16);window.crypto.getRandomValues(bytes);
  return Array.prototype.map.call(bytes,function(byte){return byte.toString(16).padStart(2,'0')}).join('');
}
function hex(buffer){return Array.prototype.map.call(new Uint8Array(buffer),function(byte){return byte.toString(16).padStart(2,'0')}).join('')}
function hashPassword(password,salt){
  if(!window.crypto||!window.crypto.subtle) return Promise.reject(new Error('Secure password hashing is unavailable. Use VS Code Live Server (localhost) in a modern browser.'));
  var encoder=new TextEncoder();
  return window.crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']).then(function(key){
    return window.crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:120000,hash:'SHA-256'},key,256);
  }).then(hex);
}
function saveSession(user,remember){
  var value={name:user.name,business:user.business,email:user.email};
  localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY);
  (remember?localStorage:sessionStorage).setItem(SESSION_KEY,JSON.stringify(value));
}
var authService={
  getSession:session,
  signIn:function(email,password,remember){
    var user=getUser(email);
    if(!user)return hashPassword(password,'invoicepro-no-account-salt').then(function(){throw new Error('Email or password is incorrect.')});
    return hashPassword(password,user.salt).then(function(hash){
      if(hash!==user.passwordHash)throw new Error('Email or password is incorrect.');
      saveSession(user,remember);return user;
    });
  },
  register:function(account,password){
    if(getUser(account.email))return Promise.reject(new Error('An account with this email already exists. Sign in instead.'));
    var salt=randomSalt();
    return hashPassword(password,salt).then(function(passwordHash){
      var records=users();
      if(records.some(function(user){return user.email===account.email}))throw new Error('An account with this email already exists. Sign in instead.');
      records.push({name:account.name,business:account.business,email:account.email,salt:salt,passwordHash:passwordHash});
      localStorage.setItem(USERS_KEY,JSON.stringify(records));
    });
  },
  requestPasswordReset:function(email){
    if(!getUser(email))return Promise.resolve(null);
    var code=String(window.crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
    sessionStorage.setItem(RESET_KEY,JSON.stringify({email:email,code:code,expires:Date.now()+15*60*1000}));
    return Promise.resolve(code);
  },
  resetPassword:function(email,code,password){
    var reset=JSON.parse(sessionStorage.getItem(RESET_KEY)||'null');
    if(!reset||reset.email!==email||reset.code!==code||reset.expires<Date.now())
      return Promise.reject(new Error('The reset code is invalid or expired. Request a new one.'));
    var user=getUser(email);
    if(!user)return Promise.reject(new Error('The reset code is invalid or expired. Request a new one.'));
    var salt=randomSalt();
    return hashPassword(password,salt).then(function(passwordHash){
      var records=users(),index=records.findIndex(function(record){return record.email===email});
      if(index<0)throw new Error('The account could not be found.');
      records[index].salt=salt;records[index].passwordHash=passwordHash;
      localStorage.setItem(USERS_KEY,JSON.stringify(records));sessionStorage.removeItem(RESET_KEY);
    });
  },
  signOut:function(){
    localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY);
  }
};
function goDashboard(){
  var view='dashboard';
  try{
    var appData=JSON.parse(localStorage.getItem('invoicepro.v1')||'null');
    if(appData&&appData.preferences&&appData.preferences.defaultView==='invoices')view='invoices';
  }catch(error){console.warn('InvoicePro default view preference could not be read.',error)}
  location.replace('index.html#'+view);
}
function onSubmit(id,handler){
  var form=$('#'+id);if(!form)return;
  form.addEventListener('submit',function(event){
    event.preventDefault();
    var message=$('#'+id.replace('-form','')+'-message');if(message){message.hidden=true;message.classList.remove('success')}
    Promise.resolve().then(function(){return handler(new FormData(form),form)}).catch(function(error){
      showMessage(message,error.message||'Something went wrong. Please try again.',false);
    });
  });
}
function setupLogin(){
  onSubmit('login-form',function(data){
    var email=String(data.get('email')||'').trim().toLowerCase(),password=String(data.get('password')||'');
    if(!validEmail(email))throw new Error('Enter a valid email address.');
    if(!password)throw new Error('Enter your password.');
    return authService.signIn(email,password,data.get('remember')==='on').then(goDashboard);
  });
}
function setupSignup(){
  onSubmit('signup-form',function(data){
    var name=String(data.get('name')||'').trim(),business=String(data.get('business')||'').trim();
    var email=String(data.get('email')||'').trim().toLowerCase(),password=String(data.get('password')||'');
    var confirm=String(data.get('confirm')||'');
    if(!name||!business||!email||!password||!confirm)throw new Error('Complete all required fields.');
    if(!validEmail(email))throw new Error('Enter a valid email address.');
    if(!strongPassword(password))throw new Error('Use at least 8 characters, including a letter and a number.');
    if(password!==confirm)throw new Error('Passwords do not match.');
    if(data.get('terms')!=='on')throw new Error('Please agree to the Terms and Conditions.');
    return authService.register({name:name,business:business,email:email},password).then(function(){
      showMessage($('#signup-message'),'Account created. Sign in with your new credentials.',true);
      $('#signup-form').reset();
      window.setTimeout(function(){location.href='login.html'},1200);
    });
  });
}
function setupForgot(){
  onSubmit('forgot-form',function(data){
    $('#prototype-reset').hidden=true;
    sessionStorage.removeItem(RESET_KEY);
    var email=String(data.get('email')||'').trim().toLowerCase();
    if(!validEmail(email))throw new Error('Enter a valid email address.');
    return authService.requestPasswordReset(email).then(function(code){
      if(code){
        $('#demo-reset-code').textContent=code;
        $('#reset-link').href='reset-password.html?email='+encodeURIComponent(email);
        $('#prototype-reset').hidden=false;
      }
      showMessage($('#forgot-message'),'If an account exists for this address, password-reset instructions are ready. This frontend demo cannot send email.',true);
    });
  });
}
function setupReset(){
  var emailInput=$('#reset-email'),params=new URLSearchParams(location.search);
  if(params.get('email'))emailInput.value=params.get('email');
  onSubmit('reset-form',function(data){
    var email=String(data.get('email')||'').trim().toLowerCase(),code=String(data.get('code')||'').trim();
    var password=String(data.get('password')||''),confirm=String(data.get('confirm')||'');
    if(!validEmail(email))throw new Error('Enter a valid email address.');
    if(!strongPassword(password))throw new Error('Use at least 8 characters, including a letter and a number.');
    if(password!==confirm)throw new Error('Passwords do not match.');
    return authService.resetPassword(email,code,password).then(function(){
      showMessage($('#reset-message'),'Password updated. You can now sign in.',true);
      $('#reset-form').reset();
      window.setTimeout(function(){location.href='login.html'},1200);
    });
  });
}
function setupProfile(){
  var user=authService.getSession();
  if(!user){location.replace('login.html');return}
  var name=$('#profile-name'),email=$('#profile-email'),business=$('#profile-business'),initial=$('#profile-initial');
  if(name)name.textContent=user.name||user.business||user.email;
  if(email)email.textContent=user.email;
  if(business)business.textContent=user.business||'';
  if(initial)initial.textContent=(user.name||user.business||user.email).charAt(0).toUpperCase();
  document.querySelectorAll('[data-auth-logout]').forEach(function(button){
    button.addEventListener('click',function(){
      authService.signOut();
      location.replace('login.html');
    });
  });
}
document.addEventListener('click',function(event){
  var toggle=event.target.closest('[data-toggle-password]');
  if(toggle){
    var input=$('#'+toggle.getAttribute('data-toggle-password'));
    var visible=input.type==='password';input.type=visible?'text':'password';
    toggle.textContent=visible?'Hide':'Show';toggle.setAttribute('aria-label',visible?'Hide password':'Show password');
  }
});
function initialize(){
  if(page==='index.html'){setupProfile();return}
  if(page==='login.html'||page==='') {
    if(session()){goDashboard();return}
    setupLogin();if(sessionError)showMessage($('#login-message'),sessionError,false);
  }
  if(page==='signup.html'){
    if(session()){goDashboard();return}
    setupSignup();if(sessionError)showMessage($('#signup-message'),sessionError,false);
  }
  if(page==='forgot-password.html'){if(session()){goDashboard();return}setupForgot()}
  if(page==='reset-password.html'){if(session()){goDashboard();return}setupReset()}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
else initialize();
if(page==='index.html'&&!session())location.replace('login.html');
})();
