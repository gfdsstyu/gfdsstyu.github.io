// js/ui/explorer.js
export function mountExplorer(store){
  const right = ensure('#v4-right');
  right.innerHTML = `
    <section class="p-4 rounded-xl border bg-white dark:bg-gray-900">
      <h3 class="font-bold mb-2">탐색 패널(v4 Shell)</h3>
      <p class="text-sm text-gray-500">단원 트리와 문제 리스트가 여기에 표시됩니다.</p>
    </section>`;
}
function ensure(sel){ const n=document.querySelector(sel); if(!n) throw new Error(`missing ${sel}`); return n; }
