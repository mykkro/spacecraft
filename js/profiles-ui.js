/** In-game new-game and resume menu. Names are always inserted as text, never HTML. */
(() => {
  const tr = (en,cs) => I18n.language === 'cs' ? cs : en;
  const button = document.createElement('button');
  button.id = 'profileButton';
  button.textContent = tr('GAME','HRA');
  button.title = Profiles.current;
  document.querySelector('.header-actions').append(button);
  const overlay = document.createElement('div');
  overlay.id = 'profileOverlay'; overlay.hidden = true;
  overlay.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="profileTitle">
    <h2 id="profileTitle">${tr('Expeditions','Expedice')}</h2>
    <p id="currentProfile"></p>
    <form id="newProfileForm"><label for="profileName">${tr('New game — profile name','Nová hra — název profilu')}</label>
    <input id="profileName" maxlength="40" required autocomplete="off">
    <p>${tr('Starts a fresh expedition with ship selection. Your current profile is preserved. Saves stay in this browser.',
      'Zahájí novou expedici výběrem lodi. Současný profil zůstane zachován. Uložené hry zůstávají v tomto prohlížeči.')}</p>
    <button type="submit">${tr('NEW GAME','NOVÁ HRA')}</button></form>
    <label for="savedProfiles">${tr('Saved profiles','Uložené profily')}</label><select id="savedProfiles"></select>
    <div class="profile-actions"><button id="resumeProfile">${tr('LOAD PROFILE','NAČÍST PROFIL')}</button>
    <button id="closeProfiles">${tr('BACK','ZPĚT')} · ESC</button></div>
    <p id="profileError" role="alert"></p></section>`;
  document.body.append(overlay);
  const $ = s => overlay.querySelector(s);
  let open = false, previousPaused = false, returnFocus;
  function show() {
    if (open) return;
    previousPaused = paused; paused = true; keys.clear(); GameAudio.setEngine(0);
    returnFocus = document.activeElement;
    $('#currentProfile').textContent = tr('Current profile: ','Aktuální profil: ') + Profiles.current;
    $('#savedProfiles').replaceChildren(...Profiles.list.map(p=>{
      const option=document.createElement('option'); option.value=p.id; option.textContent=p.name;
      option.selected=p.id===Profiles.sessionId; return option;
    }));
    $('#profileError').textContent=''; $('#profileName').value='';
    open=true; overlay.hidden=false; $('#profileName').focus();
  }
  function close() {
    if (!open) return;
    open=false; overlay.hidden=true; paused=previousPaused; keys.clear(); returnFocus?.focus();
  }
  function change(action) {
    try {
      Colony.save(); StarChart.save();
      action();
      location.reload();
    } catch (error) {
      $('#profileError').textContent = error.message === 'duplicate'
        ? tr('That name already exists. Choose another name or load its profile.','Tento název již existuje. Zvolte jiný název nebo načtěte profil.')
        : error.message === 'name'
          ? tr('Enter a name between 1 and 40 characters.','Zadejte název o délce 1 až 40 znaků.')
          : tr('Could not save the profile. Check browser storage and available space.','Profil nelze uložit. Zkontrolujte úložiště prohlížeče a volné místo.');
    }
  }
  button.onclick=show;
  $('#newProfileForm').onsubmit=event=>{event.preventDefault();change(()=>Profiles.create($('#profileName').value));};
  $('#resumeProfile').onclick=()=>change(()=>Profiles.select($('#savedProfiles').value));
  $('#closeProfiles').onclick=close;
  addEventListener('keydown',event=>{
    if (!open) return;
    event.stopImmediatePropagation();
    if(event.code==='Escape'){event.preventDefault();close();}
    if(event.code==='Tab'){
      const controls=[...overlay.querySelectorAll('input,select,button')],index=controls.indexOf(document.activeElement);
      event.preventDefault();controls[(index+(event.shiftKey?-1:1)+controls.length)%controls.length]?.focus();
    }
  },true);
})();
