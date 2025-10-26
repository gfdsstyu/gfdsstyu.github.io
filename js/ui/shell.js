// js/ui/shell.js
export function renderShell(){
  const root = document.getElementById('v4-root');
  if(!root){
    const shell = document.createElement('div');
    shell.id = 'v4-root';
    shell.className = 'hidden md:grid grid-cols-12 gap-4 p-4';
    shell.innerHTML = `
      <aside id="v4-left" class="col-span-3 space-y-4"></aside>
      <main  id="v4-center" class="col-span-6"></main>
      <aside id="v4-right" class="col-span-3 space-y-4"></aside>
    `;
    // place below existing header
    const anchor = document.querySelector('#fixed-header');
    (anchor?.nextElementSibling||document.body).after(shell);
  }
}
