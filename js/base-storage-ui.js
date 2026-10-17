/** Base container UI: shared stack limits, click/half/one transfers and cross-pane drag/drop. */
const BaseStorageUI = (() => {
  const tr=(en,cs)=>I18n.language==='cs'?cs:en;
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const overlay=document.createElement('div');overlay.id='baseStorageOverlay';overlay.hidden=true;
  overlay.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="storageTitle">
    <div class="storage-heading"><h2 id="storageTitle">${tr('Base storage','Sklad základny')}</h2><button id="closeStorage">${tr('BACK','ZPĚT')} · ESC</button></div>
    <label for="storageSelect">${tr('Container','Kontejner')}</label><select id="storageSelect"></select>
    <p>${tr('Click: move stack · Right click: half · Shift-click: one · Drag between inventories','Kliknutí: přesun · Pravé tlačítko: polovina · Shift: jeden kus · Přetahujte mezi inventáři')}</p>
    <div class="storage-panes"><div><h3>${tr('Ship cargo','Náklad lodi')}</h3><div id="storageCargo" class="storage-grid"></div></div>
    <div><h3 id="storageCapacity"></h3><div id="storageItems" class="storage-grid"></div></div></div>
    <p id="storageMessage" role="status"></p></section>`;
  document.body.append(overlay);
  const button=document.createElement('button');button.id='inventoryStorage';button.textContent=tr('STORAGE','SKLAD');
  document.querySelector('.inventory-footer').append(button);
  const $=s=>overlay.querySelector(s);
  let open=false,selected=null,previousPaused=false,returnFocus;
  const mime='application/x-spacecraft-storage';
  function markup(stack,index,side){
    const item=stack&&Colony.items[stack.type];
    const label=item?item.name+' × '+stack.qty+' / '+item.maxStack:tr('Empty slot','Prázdný slot');
    return `<button class="item-slot" data-storage-side="${side}" data-storage-index="${index}" title="${escape(label)}" aria-label="${escape(label)}" draggable="${!!item}">
      ${item?'<img class="item-icon" src="assets/items/'+(item.asset||(item.image||stack.type)+'.png')+'" alt="" width="40" height="40"><small>'+stack.qty+'</small>':''}</button>`;
  }
  function move(side,index,amount,toIndex=null){
    const ok=Colony.transferStorage(selected,side,index,amount,toIndex);
    $('#storageMessage').textContent=ok?'':tr('No transfer: check free space and put any held stack back in cargo.','Přesun nelze provést: zkontrolujte volné místo a vraťte držené předměty do nákladu.');
    render();return ok;
  }
  function render(){
    if(!open)return;
    const containers=Colony.storageContainers();
    if(!containers.some(c=>c.id===selected))selected=containers[0]?.id||null;
    const cargoScroll=$('#storageCargo').scrollTop||0,storageScroll=$('#storageItems').scrollTop||0;
    $('#storageSelect').innerHTML=containers.map(c=>'<option value="'+c.id+'">'+escape(Colony.items[c.type].name)+' · '+c.x+','+c.y+' · '+c.used+'/'+c.capacity+'</option>').join('');
    $('#storageSelect').value=selected||'';
    const slots=selected?Colony.storageSlots(selected):null;
    $('#storageCapacity').textContent=slots?tr('Storage','Sklad')+' · '+slots.filter(Boolean).length+'/'+slots.length:tr('No accessible containers','Žádné dostupné kontejnery');
    $('#storageCargo').innerHTML=Colony.bag.map((s,i)=>markup(s,i,'bag')).join('');
    $('#storageItems').innerHTML=slots?slots.map((s,i)=>markup(s,i,'storage')).join(''):'';
    overlay.querySelectorAll('[data-storage-side]').forEach(slot=>{
      const side=slot.dataset.storageSide,index=Number(slot.dataset.storageIndex);
      const current=()=>side==='bag'?Colony.bag[index]:Colony.storageSlots(selected)?.[index];
      slot.onclick=e=>{const s=current();if(s)move(side,index,e.shiftKey?1:s.qty);};
      slot.oncontextmenu=e=>{e.preventDefault();const s=current();if(s)move(side,index,Math.ceil(s.qty/2));};
      slot.ondragstart=e=>{
        const s=current();if(!s){e.preventDefault();return;}
        e.dataTransfer.setData(mime,JSON.stringify({id:selected,side,index,type:s.type,qty:e.shiftKey?Math.ceil(s.qty/2):s.qty}));
        e.dataTransfer.effectAllowed='move';
      };
      slot.ondragover=e=>{if(Array.from(e.dataTransfer.types).includes(mime))e.preventDefault();};
      slot.ondrop=e=>{
        e.preventDefault();
        try{
          const p=JSON.parse(e.dataTransfer.getData(mime));
          if(p.id!==selected||p.side===side||!['bag','storage'].includes(p.side))return;
          const source=p.side==='bag'?Colony.bag[p.index]:Colony.storageSlots(selected)?.[p.index];
          if(source?.type!==p.type)return;
          move(p.side,p.index,p.qty,index);
        }catch{}
      };
    });
    $('#storageCargo').scrollTop=cargoScroll;$('#storageItems').scrollTop=storageScroll;
  }
  function refresh(){
    const count=Colony.storageContainers().length;
    button.disabled=count===0;button.textContent=tr('STORAGE','SKLAD')+' ('+count+')';
    if(open)render();
  }
  function show(id=null){
    if(open)return;
    const containers=Colony.storageContainers();if(!containers.length)return false;
    selected=containers.some(c=>c.id===id)?id:containers[0].id;
    previousPaused=paused;returnFocus=document.activeElement;paused=true;keys.clear();GameAudio.setEngine(0);
    open=true;overlay.hidden=false;$('#storageMessage').textContent='';render();$('#storageSelect').focus();return true;
  }
  function close(){
    if(!open)return;
    open=false;overlay.hidden=true;paused=previousPaused;keys.clear();
    if(!document.querySelector('#overlay').hidden)Colony.openInventory();
    returnFocus?.focus();
  }
  button.onclick=()=>show();
  $('#storageSelect').onchange=e=>{selected=e.target.value;render();};
  $('#closeStorage').onclick=close;
  addEventListener('keydown',e=>{
    if(!open)return;e.stopImmediatePropagation();
    if(e.code==='Escape'||e.code==='KeyE'){e.preventDefault();close();}
    if(e.code==='Tab'){
      const controls=[...overlay.querySelectorAll('button:not(:disabled),select')],i=controls.indexOf(document.activeElement);
      e.preventDefault();controls[(i+(e.shiftKey?-1:1)+controls.length)%controls.length]?.focus();
    }
  },true);
  refresh();
  return {show,close,refresh,get isOpen(){return open;}};
})();
