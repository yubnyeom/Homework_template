// =============================================
//  사진 보관 — 브라우저 안의 큰 저장소(IndexedDB)에 사진을 넣어 둬요
//  (기록은 localStorage에, 사진은 크기가 커서 여기에 따로 저장해요)
// =============================================
const PhotoDB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open('skin-garden-photos', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', mode);
      const req = fn(tx.objectStore('photos'));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
    });
  };
  return {
    put: (id, blob) => run('readwrite', st => st.put(blob, id)),
    get: id => run('readonly', st => st.get(id)),
    del: id => run('readwrite', st => st.delete(id)),
  };
})();

// 사진을 긴 쪽 1280px, JPEG로 줄여서 저장 공간을 아껴요
function compressImage(file, max = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('사진을 줄이지 못했어요'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했어요')); };
    img.src = url;
  });
}

// 사진 id → 화면에 띄울 주소 (한 번 만든 주소는 다시 써요)
const photoURLCache = {};
async function photoURL(id) {
  if (photoURLCache[id]) return photoURLCache[id];
  const blob = await PhotoDB.get(id);
  if (!blob) return null;
  photoURLCache[id] = URL.createObjectURL(blob);
  return photoURLCache[id];
}

async function deletePhotos(list) {
  for (const ph of list || []) {
    try { await PhotoDB.del(ph.id); } catch (e) { /* 무시 */ }
    if (photoURLCache[ph.id]) { URL.revokeObjectURL(photoURLCache[ph.id]); delete photoURLCache[ph.id]; }
  }
}

// <img data-pid="..."> 들의 사진을 채워 넣어요
function fillPhotoImgs(root) {
  root.querySelectorAll('img[data-pid]').forEach(async el => {
    const url = await photoURL(el.dataset.pid);
    if (url) el.src = url;
  });
}
