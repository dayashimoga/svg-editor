/* SVG Editor - Full Implementation */
'use strict';
(function(){
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const svg=$('#svgCanvas'), ns='http://www.w3.org/2000/svg';
let currentTool='select',selectedEl=null,isDrawing=false,startX=0,startY=0,drawEl=null;
let elements=[],undoStack=[],redoStack=[];
let pathPoints=[];

function getSvgPoint(e){
  const r=svg.getBoundingClientRect();
  return {x:Math.round(e.clientX-r.left),y:Math.round(e.clientY-r.top)};
}

// Tool selection
$$('.tool-btn[data-tool]').forEach(b=>b.addEventListener('click',()=>{
  $$('.tool-btn[data-tool]').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); currentTool=b.dataset.tool;
  if(currentTool!=='select') deselectAll();
  if(currentTool!=='path'&&pathPoints.length) finishPath();
}));

function pushUndo(){
  undoStack.push(svg.innerHTML);
  if(undoStack.length>50)undoStack.shift();
  redoStack=[];
}

$('#undoBtn').addEventListener('click',()=>{
  if(!undoStack.length)return;
  redoStack.push(svg.innerHTML);
  svg.innerHTML=undoStack.pop();
  deselectAll();
});
$('#redoBtn').addEventListener('click',()=>{
  if(!redoStack.length)return;
  undoStack.push(svg.innerHTML);
  svg.innerHTML=redoStack.pop();
  deselectAll();
});

function deselectAll(){
  if(selectedEl)selectedEl.classList.remove('svg-element-selected');
  selectedEl=null;
  $('#propFields').innerHTML='<p class="text-muted" style="font-size:0.8rem">Select an element to edit</p>';
}

function selectElement(el){
  deselectAll();
  selectedEl=el;
  el.classList.add('svg-element-selected');
  updatePropFields();
}

function updatePropFields(){
  if(!selectedEl)return;
  const tag=selectedEl.tagName.toLowerCase();
  let html='<div style="font-size:0.75rem;color:var(--accent);font-weight:700;margin-bottom:0.5rem">'+tag.toUpperCase()+'</div>';
  const attrs=tag==='rect'?['x','y','width','height']:tag==='circle'?['cx','cy','r']:tag==='ellipse'?['cx','cy','rx','ry']:tag==='line'?['x1','y1','x2','y2']:tag==='text'?['x','y']:[];
  attrs.forEach(a=>{
    const v=selectedEl.getAttribute(a)||'0';
    html+=`<div class="prop-field-row"><label>${a}</label><input type="number" value="${v}" data-attr="${a}"></div>`;
  });
  if(tag==='text'){
    html+=`<div class="prop-field-row"><label>Text</label><input type="text" value="${selectedEl.textContent}" data-text="1"></div>`;
    html+=`<div class="prop-field-row"><label>Size</label><input type="number" value="${parseInt(selectedEl.getAttribute('font-size')||'20')}" data-fontsize="1"></div>`;
  }
  $('#propFields').innerHTML=html;
  $$('#propFields input[data-attr]').forEach(inp=>inp.addEventListener('change',()=>{
    pushUndo();selectedEl.setAttribute(inp.dataset.attr,inp.value);
  }));
  const textInp=$('#propFields input[data-text]');
  if(textInp)textInp.addEventListener('change',()=>{pushUndo();selectedEl.textContent=textInp.value;});
  const sizeInp=$('#propFields input[data-fontsize]');
  if(sizeInp)sizeInp.addEventListener('change',()=>{pushUndo();selectedEl.setAttribute('font-size',sizeInp.value);});
  // Sync color inputs
  const fill=selectedEl.getAttribute('fill');
  if(fill&&fill!=='none'){$('#fillColor').value=fill;$('#noFill').checked=false;}
  else{$('#noFill').checked=true;}
  const stroke=selectedEl.getAttribute('stroke');
  if(stroke)$('#strokeColor').value=stroke;
  const sw=selectedEl.getAttribute('stroke-width');
  if(sw){$('#strokeWidth').value=sw;$('#strokeWidthVal').textContent=sw;}
  const op=selectedEl.getAttribute('opacity');
  if(op){$('#opacity').value=Math.round(op*100);$('#opacityVal').textContent=Math.round(op*100)+'%';}
  const tr=selectedEl.getAttribute('transform');
  if(tr){const m=tr.match(/rotate\((\d+)/);if(m){$('#rotation').value=m[1];$('#rotationVal').textContent=m[1]+'°';}}
}

// Property changes
$('#fillColor').addEventListener('input',()=>{if(selectedEl){pushUndo();selectedEl.setAttribute('fill',$('#fillColor').value);$('#noFill').checked=false;}});
$('#noFill').addEventListener('change',()=>{if(selectedEl){pushUndo();selectedEl.setAttribute('fill',$('#noFill').checked?'none':$('#fillColor').value);}});
$('#strokeColor').addEventListener('input',()=>{if(selectedEl){pushUndo();selectedEl.setAttribute('stroke',$('#strokeColor').value);}});
$('#strokeWidth').addEventListener('input',()=>{$('#strokeWidthVal').textContent=$('#strokeWidth').value;if(selectedEl){pushUndo();selectedEl.setAttribute('stroke-width',$('#strokeWidth').value);}});
$('#opacity').addEventListener('input',()=>{$('#opacityVal').textContent=$('#opacity').value+'%';if(selectedEl){pushUndo();selectedEl.setAttribute('opacity',$('#opacity').value/100);}});
$('#rotation').addEventListener('input',()=>{
  $('#rotationVal').textContent=$('#rotation').value+'°';
  if(selectedEl){
    pushUndo();
    const bb=selectedEl.getBBox();
    const cx=bb.x+bb.width/2,cy=bb.y+bb.height/2;
    selectedEl.setAttribute('transform',`rotate(${$('#rotation').value} ${cx} ${cy})`);
  }
});

// Actions
$('#deleteBtn').addEventListener('click',()=>{if(selectedEl){pushUndo();selectedEl.remove();deselectAll();}});
$('#duplicateBtn').addEventListener('click',()=>{if(selectedEl){pushUndo();const clone=selectedEl.cloneNode(true);const bb=selectedEl.getBBox();if(clone.getAttribute('x'))clone.setAttribute('x',parseFloat(clone.getAttribute('x'))+20);if(clone.getAttribute('cx'))clone.setAttribute('cx',parseFloat(clone.getAttribute('cx'))+20);svg.appendChild(clone);selectElement(clone);}});
$('#bringFrontBtn').addEventListener('click',()=>{if(selectedEl){pushUndo();svg.appendChild(selectedEl);}});
$('#sendBackBtn').addEventListener('click',()=>{if(selectedEl){pushUndo();const first=svg.querySelector(':not(defs):not(rect:first-of-type)');if(first)svg.insertBefore(selectedEl,first);}});
$('#clearAllBtn').addEventListener('click',()=>{if(!confirm('Clear all elements?'))return;pushUndo();const keep=svg.querySelector('defs');const bg=svg.querySelector('rect');svg.innerHTML='';if(keep)svg.appendChild(keep);if(bg)svg.appendChild(bg);deselectAll();});

// Drawing
let dragOffset={x:0,y:0},isDragging=false;

svg.addEventListener('mousedown',e=>{
  const pt=getSvgPoint(e);
  $('#coordsDisplay').textContent=`${pt.x}, ${pt.y}`;

  if(currentTool==='select'){
    const target=e.target.closest('circle,rect,ellipse,line,text,polyline,path,polygon');
    if(target&&target!==svg&&!target.closest('defs')&&target.getAttribute('fill')!=='url(#grid)'){
      selectElement(target);
      isDragging=true;
      const bb=target.getBBox();
      dragOffset={x:pt.x-bb.x,y:pt.y-bb.y};
    } else { deselectAll(); }
    return;
  }

  if(currentTool==='path'){
    pathPoints.push(pt);
    renderPathPreview();
    return;
  }

  pushUndo();isDrawing=true;startX=pt.x;startY=pt.y;
  const fill=$('#noFill').checked?'none':$('#fillColor').value;
  const stroke=$('#strokeColor').value;
  const sw=$('#strokeWidth').value;

  if(currentTool==='rect'){
    drawEl=document.createElementNS(ns,'rect');
    drawEl.setAttribute('x',pt.x);drawEl.setAttribute('y',pt.y);
    drawEl.setAttribute('width',0);drawEl.setAttribute('height',0);
    drawEl.setAttribute('fill',fill);drawEl.setAttribute('stroke',stroke);drawEl.setAttribute('stroke-width',sw);
    svg.appendChild(drawEl);
  } else if(currentTool==='circle'){
    drawEl=document.createElementNS(ns,'circle');
    drawEl.setAttribute('cx',pt.x);drawEl.setAttribute('cy',pt.y);drawEl.setAttribute('r',0);
    drawEl.setAttribute('fill',fill);drawEl.setAttribute('stroke',stroke);drawEl.setAttribute('stroke-width',sw);
    svg.appendChild(drawEl);
  } else if(currentTool==='ellipse'){
    drawEl=document.createElementNS(ns,'ellipse');
    drawEl.setAttribute('cx',pt.x);drawEl.setAttribute('cy',pt.y);
    drawEl.setAttribute('rx',0);drawEl.setAttribute('ry',0);
    drawEl.setAttribute('fill',fill);drawEl.setAttribute('stroke',stroke);drawEl.setAttribute('stroke-width',sw);
    svg.appendChild(drawEl);
  } else if(currentTool==='line'){
    drawEl=document.createElementNS(ns,'line');
    drawEl.setAttribute('x1',pt.x);drawEl.setAttribute('y1',pt.y);
    drawEl.setAttribute('x2',pt.x);drawEl.setAttribute('y2',pt.y);
    drawEl.setAttribute('stroke',stroke);drawEl.setAttribute('stroke-width',sw);
    svg.appendChild(drawEl);
  } else if(currentTool==='text'){
    drawEl=document.createElementNS(ns,'text');
    const txt=prompt('Enter text:','Hello');
    if(txt){
      drawEl.setAttribute('x',pt.x);drawEl.setAttribute('y',pt.y);
      drawEl.setAttribute('fill',fill==='none'?$('#fillColor').value:fill);
      drawEl.setAttribute('font-size','20');drawEl.setAttribute('font-family','Arial, sans-serif');
      drawEl.textContent=txt;svg.appendChild(drawEl);selectElement(drawEl);
    }
    isDrawing=false;drawEl=null;
  }
});

svg.addEventListener('mousemove',e=>{
  const pt=getSvgPoint(e);
  $('#coordsDisplay').textContent=`${pt.x}, ${pt.y}`;

  if(isDragging&&selectedEl){
    const tag=selectedEl.tagName.toLowerCase();
    if(tag==='rect'||tag==='text'||tag==='image'){
      selectedEl.setAttribute('x',pt.x-dragOffset.x);
      selectedEl.setAttribute('y',pt.y-dragOffset.y);
    } else if(tag==='circle'||tag==='ellipse'){
      selectedEl.setAttribute('cx',pt.x-dragOffset.x+(selectedEl.getBBox().width/2));
      selectedEl.setAttribute('cy',pt.y-dragOffset.y+(selectedEl.getBBox().height/2));
    }
    return;
  }

  if(!isDrawing||!drawEl)return;
  if(currentTool==='rect'){
    const w=pt.x-startX,h=pt.y-startY;
    drawEl.setAttribute('x',w<0?pt.x:startX);drawEl.setAttribute('y',h<0?pt.y:startY);
    drawEl.setAttribute('width',Math.abs(w));drawEl.setAttribute('height',Math.abs(h));
  } else if(currentTool==='circle'){
    drawEl.setAttribute('r',Math.sqrt(Math.pow(pt.x-startX,2)+Math.pow(pt.y-startY,2)));
  } else if(currentTool==='ellipse'){
    drawEl.setAttribute('rx',Math.abs(pt.x-startX));drawEl.setAttribute('ry',Math.abs(pt.y-startY));
  } else if(currentTool==='line'){
    drawEl.setAttribute('x2',pt.x);drawEl.setAttribute('y2',pt.y);
  }
});

svg.addEventListener('mouseup',()=>{
  if(isDragging){isDragging=false;pushUndo();updatePropFields();return;}
  if(isDrawing&&drawEl){selectElement(drawEl);}
  isDrawing=false;drawEl=null;
});

function renderPathPreview(){
  let existing=svg.querySelector('#pathPreview');
  if(!existing){existing=document.createElementNS(ns,'path');existing.id='pathPreview';
    existing.setAttribute('fill','none');existing.setAttribute('stroke',$('#strokeColor').value);
    existing.setAttribute('stroke-width',$('#strokeWidth').value);existing.setAttribute('stroke-dasharray','5,5');svg.appendChild(existing);}
  const d=pathPoints.map((p,i)=>(i===0?'M':'L')+p.x+' '+p.y).join(' ');
  existing.setAttribute('d',d);
}

function finishPath(){
  if(pathPoints.length<2){pathPoints=[];const pv=svg.querySelector('#pathPreview');if(pv)pv.remove();return;}
  pushUndo();
  const preview=svg.querySelector('#pathPreview');
  if(preview){
    preview.removeAttribute('id');preview.removeAttribute('stroke-dasharray');
    const fill=$('#noFill').checked?'none':$('#fillColor').value;
    preview.setAttribute('fill',fill);selectElement(preview);
  }
  pathPoints=[];
}

svg.addEventListener('dblclick',()=>{if(currentTool==='path'&&pathPoints.length)finishPath();});

// Export
$('#exportSvgBtn').addEventListener('click',()=>{
  deselectAll();const data=new XMLSerializer().serializeToString(svg);
  const blob=new Blob([data],{type:'image/svg+xml'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='drawing.svg';a.click();
  if(typeof QU!=='undefined')QU.showToast('SVG exported!','success');
});

$('#exportPngBtn').addEventListener('click',()=>{
  deselectAll();const data=new XMLSerializer().serializeToString(svg);
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;
  const ctx=canvas.getContext('2d');const img=new Image();
  img.onload=()=>{ctx.drawImage(img,0,0);
    const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='drawing.png';a.click();
    if(typeof QU!=='undefined')QU.showToast('PNG exported!','success');
  };
  img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(data)));
});

// Keyboard shortcuts
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();$('#deleteBtn').click();}
  if(e.ctrlKey&&e.key==='z'){e.preventDefault();$('#undoBtn').click();}
  if(e.ctrlKey&&e.key==='y'){e.preventDefault();$('#redoBtn').click();}
  if(e.ctrlKey&&e.key==='d'){e.preventDefault();$('#duplicateBtn').click();}
});

if(typeof QU!=='undefined')QU.init({kofi:true,discover:true});
})();
