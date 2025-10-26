export function mountShell() {
  // v4 3분할 컨테이너 생성 (기존 v3.2 카드 아래에 추가)
  const root = document.querySelector('body');
  const host = document.createElement('div');
  host.id = 'v4-shell';
  host.className = 'max-w-6xl mx-auto p-4 grid grid-cols-12 gap-4';
  host.innerHTML = `
    <aside id="v4-left" class="col-span-12 md:col-span-3 space-y-4"></aside>
    <main id="v4-center" class="col-span-12 md:col-span-6"></main>
    <aside id="v4-right" class="col-span-12 md:col-span-3">
      <section class="p-4 rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800">
        <h3 class="font-bold mb-2 text-gray-900 dark:text-gray-100">탐색 패널(v4 Shell)</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">단원 트리와 문제 리스트가 여기에 표시됩니다.</p>
      </section>
    </aside>`;
  const anchor = document.querySelector('#summary-area')?.parentElement || root;
  anchor.appendChild(host);
}
