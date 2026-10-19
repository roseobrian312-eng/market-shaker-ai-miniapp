const form=document.getElementById('config');const notice=document.getElementById('notice');
form.addEventListener('submit',async e=>{
 e.preventDefault();const code=document.getElementById('code').value.trim();
 if(code.length<16){notice.textContent='Use at least 16 characters.';return;}
 try{await chrome.storage.local.set({accessCode:code});notice.textContent='Access code saved locally. Open the Pocket Option tab to use your widget.';document.getElementById('code').value='';}
 catch{notice.textContent='Could not save access code in this Chrome profile.';}
});
